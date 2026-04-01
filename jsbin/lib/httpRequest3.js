"use strict";

const iconv = require('iconv-lite');
const { http } = require('follow-redirects');
const mdb = require('../db/db_con1');
const { log } = require('winston');

const logger = require('./logs/aqtLogger').child({ label: 'httpRequest' });

let con;
process.on('SIGTERM', endProc);
process.on('uncaughtException', (err) => { logger.error(err) });
(async () => {
  con = await mdb.getCon();
  logger.info(`HTTP Request Worker Ready ,${con.threadId}`);
  process.send({ ready: 1 });
})();
const ckMap = new Map();

// let mybns = checkCon(0);
// const {tcode, cond, dbskip, interval, limit, loop } = workerData ;
const param = JSON.parse(process.argv[2]);

function endProc() {
  if (con) con.end();
  process.exit(0);
}

process.on('message', (pkey) => {
  if (pkey?.svCook) {
    saveCookie(pkey.svCook, pkey.svKey);
    return;
  }
  con.ping().catch(async err => {
    logger.error(err);
    await con.end();
    con = await mdb.getCon();
  });

  logger.info(`Received pkey : ${pkey}`);
  con.query(`SELECT t.tcode,t.appid, t.pkey,o_stime, if( IFNULL(thost,'')>'',thost ,dstip) dstip,
      if( IFNULL(tport,0)>0, tport, dstport) dstport,uri,method,params, headers, sdata, rlen , ifnull(encval,'') encval 
     FROM vtcppacket t  where t.pkey = ? `, [pkey])
    .then(rdata => dataHandle(rdata[0]))
    .catch(err => {
      logger.error(`select error: ${pkey} - ${err.message}`);
      process.send({ err: 1 });
    });
});
function checkCon(id) {
  if (id > 0) clearInterval(id);
  return setInterval(() => {
    con.query('select 1');
  }, 10 * 60 * 1000);
}
function dataHandle(rdata) {
  let sdataStr = rdata.encval.length > 1 ? iconv.decode(rdata.sdata, rdata.encval).toString() : rdata.sdata.toString();

  /* let uri = /^(GET|POST|DELETE|PUT|PATCH)\s+(\S+)\s/s.exec(sdataStr)[2]; */
  let uri = rdata.uri;
  if (uri.indexOf('%') == -1) uri = encodeURI(uri);
/* 
  if (/[^a-z0-9\:\/\?\#\[\]\@\!\$\&\'\(\)\*\+\,\;\=\.\-\_\~\%]/i.test(uri)) {
    rdata.encval = 'euc-kr';
    sdataStr = iconv.decode(rdata.sdata, 'EUC-KR').toString();
    uri = /^(GET|POST|DELETE|PUT|PATCH)\s+(\S+)\s/s.exec(sdataStr)[2];
    uri = encodeURI(iconv.encode(uri, 'EUC-KR'));
  }
 */  
  if (/[^a-z0-9\:\/\?\#\[\]\@\!\$\&\'\(\)\*\+\,\;\=\.\-\_\~\%]/i.test(uri)) {

    logger.info("%s ** inValid URI : %s , uid=%d", rdata.tcode, uri, rdata.pkey);
    process.send({ ready: 1 });
    return;
  }
  const options = {
    method: rdata.method,
    timeout: param.aqttimeout,
    headers: {
      // connection: "keep-alive",
    },
  };
  if (sdataStr.length > 0) options.body = sdataStr;

  const shead = rdata.headers ;

  const shead2 = shead.split('\r\n');
  let new_shead = "";
  for (const v of shead2) {
    const kv = v.split(':');
    // if (/(Content-Type|Referer|upgrade-Insecure-Requests|Accept|Cookie)/.test(kv[0])) {
    if (! /^(GET|POST|DELETE|PUT|PATCH|Host)\b/i.test(kv[0])) {
      let val = kv.slice(1).join(':').trim();
      if (/^Cookie/i.test(kv[0])) val = change_cookie(val);
      if (/^X-WebLogic-Force-JVMID/i.test(kv[0])) {
        const sv_ck = ckMap.get(rdata.dstip + ":" + rdata.dstport);
        TOPL: for (const k in sv_ck) {
          const re = new RegExp("^" + k);
          if (!re.test(uri)) continue;
          for (const k2 in sv_ck[k]) {
            if (/jsessionid|user\.info/i.test(k2)) {
              const lval = sv_ck[k][k2].split('!')[1];
              val = lval || val;
              break TOPL;
            }
          }
        }
      }
      if (/^Referer/i.test(kv[0])) {
        const re = new RegExp("(https?://).*?/");
        val = val.replace(re, "$1" + rdata.dstip + ':' + rdata.dstport + '/');
      }
      if (kv[0].length > 0) {
        options.headers[kv[0]] = val;
        new_shead += kv[0] + ': ' + val + '\r\n';
      }
    }
  };
  // logger.info(`newHeader: ${new_shead}  `);
  options.headers['Content-Length'] = Buffer.byteLength(sdataStr);
  const stimem = performance.now();
  const stime = (new Date()).getTime() / 1000;
  const auri = `http://${rdata.dstip}:${rdata.dstport}${uri}`;
  logger.info(`uri : ${rdata.method} ${auri}  id=${rdata.pkey} `);
  fetch(auri, options)
  .then( async (res) => {
    let resHs = `HTTP/1.1 ${res.status} ${res.statusText}\r\n`;
    // logger.info(`Res : ${res.headers.get("content-type")}  `);
/*
    if (res.getHeader("set-cookie") && res.getHeader("set-cookie").length > 0) {
        process.send({ svCook: res.getHeader("set-cookie") , svKey: rdata.dstip + ":" + rdata.dstport });
    } */
    res.headers.forEach((value,key) => {
      resHs += key + ': ' + value + '\r\n';
    });
    
    // res.setEncoding('utf8');
    let recvData = res.ok ? await res.json() : '' ;
    let errtext = res.ok ? '' : res.statusText ;
    // res.once('readable', () => {
    //   stime = moment() ;
    // }) ;

      const rtimem = performance.now();
      const svctime = (rtimem - stimem) / 1000;
      const rtime = stime + svctime;
      let rDatas = Buffer.from(JSON.stringify(recvData)) ;
      const rsz = res.headers['content-length'] || rDatas.length;
      //         logger.info(` ${stime.toSqlfmt()} ${rtime.toSqlfmt()} ${svctime} id=${rdata.pkey} Recv len=${rsz} ` );
      // let new_d = Buffer.from(resdata,'binary') ;
      con.query(`UPDATE vpacket SET 
                    rdata = ?, headers = ?, stime = from_unixtime(?), rtime = from_unixtime(?), 
                     elapsed = ?, rcode = ? ,errinfo=?,rhead = ?, rlen = ? ,cdate = now() where pkey = ? `
        , [rDatas, new_shead, stime, rtime, svctime, res.status,res.statusText, resHs, rsz, rdata.pkey])
        .catch(err => {
          logger.error('update error:%d %s', rdata.pkey, err.message);
          process.send({ err: 1 });
        })
        .then(process.send({ ok: 1 }));
    
  })
  .catch( (e) => {
    // console.error(PGNM, e.message, e.errno);
    const rtimem = performance.now();
    const svctime = (rtimem - stimem) / 1000;
    const rtime = stime + svctime;

    if (!param.dbskip)
      con.query(`UPDATE vpacket SET 
                      headers = ?,  stime = from_unixtime(?), rtime = from_unixtime(?),  elapsed = ?,
                      rcode = ? , errinfo = ? , cdate = now() where pkey = ?`
        , [new_shead, stime, rtime, svctime, 999, e.message, rdata.pkey])
        .catch(err => logger.error('update error:', err));
    ;
    process.send({ err: 1 });
  });
  
  function change_cookie(odata) {
    const ckData = parseCookies(odata);
    const sv_ck = ckMap.get(rdata.dstip + ":" + rdata.dstport);
    for (const k in sv_ck) {
      const re = new RegExp("^" + k);
      // console.log("###", k, uri);
      if (!re.test(uri)) continue;
      for (const k2 in sv_ck[k]) {
        if (/Expires|path|HttpOnly|Max-Age|Domain|SameSite/i.test(k2)) continue;
        if (ckData[k2]) ckData[k2] = sv_ck[k][k2];
      }
    }
    let newVal = '';
    for (const [k, v] of Object.entries(ckData)) newVal += k + '=' + v + ';';
    return newVal;
  }
}
function parseCookies(cookie = '') {
  // console.log("cookie : ",cookie);
  return cookie
    .split(';')
    .map(v => v.split('='))
    .map(([k, ...vs]) => [k, vs.join('=')])
    .reduce((acc, [k, v]) => {
      acc[k.trim()] = v; // decodeURIComponent(v);
      return acc;
    }, {});
}
function saveCookie(cook, svkey) {
  if (typeof cook !== 'string') return;
  const ckData = parseCookies(cook);
  const path = ckData.Path || '/';
  let sv_ckData = ckMap.get(svkey) || {};
  let xdata = sv_ckData[path] || {};
  for (const k in ckData) {
    if (/Path|HttpOnly|Secure/.test(k)) continue;
    xdata[k] = ckData[k];
  }
  sv_ckData[path] = xdata;
  ckMap.set(svkey, sv_ckData);
}
