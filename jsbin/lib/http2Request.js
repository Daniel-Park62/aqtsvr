"use strict";

const  { parentPort, threadId,  workerData } = require('worker_threads');
const moment = require('moment');
const iconv = require('iconv-lite');
const http = require('http');
const PGNM = '[httpRequest]';
moment.prototype.toSqlfmt = function (ms) {
  return this.format('YYYY-MM-DD HH:mm:ss.' + ms);
};

let con ;
(async ()=> {
  con = await require('../db/db_con1');
  // console.log(threadId,"db connected") ;
  process.on('SIGTERM', con.end );
  parentPort.postMessage({ready:1}) ;
})();
const ckMap = new Map();
// const {tcode, cond, dbskip, interval, limit, loop } = workerData ;
let param = workerData ;

// console.log("thread id:",threadId, param);

parentPort.on('message', (pkey) => {
  if (pkey?.svCook) {
    saveCookie(pkey.svCook) ;
    return ;
  }
  // console.log(pkey) ;
  con.query("SELECT t.tcode, t.pkey,o_stime, if( ifnull(m.thost2,IFNULL(c.thost,''))>'',ifnull(m.thost2,c.thost) ,dstip) dstip," +
  " if(ifnull(m.tport2,IFNULL(c.tport,0))>0, ifnull(m.tport2,c.tport), dstport) dstport,uri,method,sdata, rlen " +
  "FROM ttcppacket t join tmaster c on (t.tcode = c.code ) left join thostmap m on (t.tcode = m.tcode and t.dstip = m.thost and t.dstport = m.tport) " +
  "where t.pkey = ? ", [pkey])
  .then( rdata =>  dataHandle(rdata[0]) ) ;
  
});

function dataHandle(rdata ) {
  let sdataStr = rdata.sdata.toString();
  if (! /^(GET|POST|DELETE|PUT|PATCH)\s+(\S+)\s/s.test(sdataStr)) {
    parentPort.postMessage({ready:1}) ;
    return ;
  }

  let uri = /^(GET|POST|DELETE|PUT|PATCH)\s+(\S+)\s/s.exec(sdataStr)[2];
  if (uri.indexOf('%') == -1) uri = encodeURI(uri);
  if (/[^a-z0-9\:\/\?\#\[\]\@\!\$\&\'\(\)\*\+\,\;\=\.\-\_\~\%]/i.test(uri)) {
    sdataStr = iconv.decode(rdata.sdata, 'EUC-KR').toString();
    uri = /^(GET|POST|DELETE|PUT|PATCH)\s+(\S+)\s/s.exec(sdataStr)[2];
    uri = encodeURI(iconv.encode(uri, 'EUC-KR'));
    // if ( uri.indexOf('%') == -1) uri = encodeURI(uri) ;
  }
  if (/[^a-z0-9\:\/\?\#\[\]\@\!\$\&\'\(\)\*\+\,\;\=\.\-\_\~\%]/i.test(uri)) {
    console.log(PGNM + "%s ** inValid URI : %s , uid=%d", rdata.tcode, uri, rdata.pkey);
    parentPort.postMessage({ready:1}) ;
    return;
  }
  const options = {
    hostname: rdata.dstip,
    port: rdata.dstport,
    path: uri,
    method: rdata.method,
    timeout: param.aqttimeout,
    headers: {
      // connection: "keep-alive",
    },
  };
  const pi = sdataStr.indexOf("\r\n\r\n");
  const shead = (pi > 0) ? sdataStr.slice(0, pi) : sdataStr;
  const shead2 = shead.split('\r\n');
  let new_shead = shead2[0] + '\r\n';
  // console.log(PGNM,shead2) ;
  for(const v of shead2) {
    const kv = v.split(':');
    // if (/(Content-Type|Referer|upgrade-Insecure-Requests|Accept|Cookie)/.test(kv[0])) {
    if (! /^(GET|POST|DELETE|PUT|PATCH|Host)/i.test(kv[0])) {
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
  let stime = moment();
  let stimem = Math.floor(process.hrtime()[1] / 1000);

  const req = http.request(options, function (res) {
    // stime = moment();
    // console.log(PGNM,'STATUS: ' + res.statusCode);
    // console.log(PGNM,'HEADERS: ' + JSON.stringify(res.headers));
    let resHs = 'HTTP/' + res.httpVersion + ' ' + res.statusCode + ' ' + res.statusMessage + "\r\n";
    for (const [key, value] of Object.entries(res.headers)) {
      resHs += `${key}: ${value}\r\n`;
      if (/set-cookie/i.test(key)) {
        saveCookie(`${value}`) ;
        parentPort.postMessage({svCook:value}) ;
      }
    };

    // res.setEncoding('utf8');
    let recvData = [];
    // res.once('readable', () => {
    //   stime = moment() ;
    // }) ;

    res.on('timeout', () => {
      // console.log(PGNM,'socket timeout');
      res.emit('error', new Error('Client timeout')) ;
      res.end();
    });
    res.on('data', function (chunk) {
      recvData.push(chunk);
    });
    res.on('end', () => {
      // console.log("* res end *",rdata.uri) ;
      if (param.dbskip) {
        // console.log("skip ok",rdata.uri)
        parentPort.postMessage({ready:1}) ;
        return;
      }
      const rtimem = Math.ceil(process.hrtime()[1] / 1000);
      const rtime = moment();
      if (rtimem < stimem && stime.isSameOrAfter(rtime, 'second')) rtime.add('1', 's');
      const svctime = moment.duration(rtime.diff(stime)).asSeconds() ;
      
      let rDatas = Buffer.concat(recvData);
      const rsz = res.headers['content-length'] || rDatas.length;

      // console.log(PGNM, stime.toSqlfmt(), rtime.toSqlfmt(), svctime, 'id=',rdata.pkey, 'rcv len=', rsz );
      // let new_d = Buffer.from(resdata,'binary') ;
       con.query("UPDATE ttcppacket SET \
                    rdata = ?, sdata = ?, stime = ?, rtime = ?,  elapsed = ?, rcode = ? ,rhead = ?, rlen = ? ,cdate = now() where pkey = ? "
        , [rDatas, Buffer.from(new_shead), stime.toSqlfmt(stimem), rtime.toSqlfmt(rtimem), svctime, res.statusCode, resHs, rsz, rdata.pkey])
          .catch(err => {
            console.error(PGNM, 'update error:', rdata.pkey, err);
            parentPort.postMessage({err:1});
           }) 
          .then(parentPort.postMessage({ok:1})) ;
    });
  });
  if (pi > 0 && /POST|PUT|DELETE|PATCH/.test(rdata.method)) {
    const sdata = sdataStr.slice(pi + 4);

    req.write(sdata);
    new_shead += '\r\n' + sdata.toString();
  }
  req.on('error', (e) => {
    // console.error(PGNM, e.message, e.errno);
    const rtime = moment();
    const rtimem = Math.ceil(process.hrtime()[1] / 1000);

    if (rtimem < stimem && stime.isSameOrAfter(rtime, 'second')) rtime.add('1', 's');
    const svctime = moment.duration(rtime.diff(stime)).asSeconds() ;

    if (!param.dbskip)
      con.query("UPDATE ttcppacket SET \
                      sdata = ?,  stime = ?, rtime = ?,  elapsed = ?, rcode = ? , rhead = ? , cdate = now() where pkey = ?"
        , [Buffer.from(new_shead), stime.toSqlfmt(stimem), rtime.toSqlfmt(rtimem), svctime, 999, e.message, rdata.pkey])
        .catch(err =>   console.error(PGNM,'update error:', err));

        ;
    parentPort.postMessage({err:1}) ;
  });
  req.end();

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
  
  function saveCookie( cook) {
    const ckData = parseCookies(cook);
    const path = ckData.Path || '/';
    let sv_ckData = ckMap.get(rdata.dstip + ':' + rdata.dstport) || {};
    let xdata = sv_ckData[path] || {};
    for (const k in ckData) {
      if (/Path|HttpOnly|Secure/.test(k)) continue;
      xdata[k] = ckData[k];
    }
  
    sv_ckData[path] = xdata;
    ckMap.set(rdata.dstip + ":" + rdata.dstport, sv_ckData);
  
  }
    
}

process.on('SIGINT', parentPort.close );

