/*
  { tcode, loop , cond, limit, dbskip, interval,jobId }
*/

"use strict";

const MAX_RESP_LEN = 1024 * 32;
const PGNM = '[sendHttp]';

const moment = require('moment');
const iconv = require('iconv-lite');
const http = require('http');
const ckMap = new Map();  // cookie 저장

const aqttimeout = process.env.aqtHttpTimeOut || 5000;
console.log("TimeOut:", aqttimeout, " (set aqtHttpTimeOut=ms)");
moment.prototype.toSqlfmt = function (ms) {
  return this.format('YYYY-MM-DD HH:mm:ss.' + ms);
};

let con = null;
let conp = null;
let dbskip = false;

module.exports =  function (param) {
  con = param.conn;
  conp = param.conp;
  if (!param.loop) param.loop = 1;
  param.loop--;
  let tcnt = 0;
  let cnt = 0;
  let ucnt = 0;
  let condi = param.cond > ' ' ? "and (" + param.cond + ")" : "";
  let vlimit = param.limit > ' ' ? ' LIMIT ' + param.limit : "";
  dbskip = param.dbskip;

  const qstr = "SELECT COUNT(*) cnt FROM ( select 1 from ttcppacket t where tcode = ? " + condi + vlimit + ") x";

  con.query(qstr, [param.tcode])
    .then(row => {
      tcnt = row[0].cnt;
      console.log(PGNM, row[0], qstr);
      console.log("%s Start 테스트id(%s) cond(%s) limit(%s) data건수 (%d) pid(%d)", PGNM, param.tcode, condi, vlimit, tcnt, process.pid);
    })
    .catch(err => console.log(PGNM, err));

  const qstream = con.queryStream("SELECT t.tcode, t.pkey,o_stime, if( ifnull(m.thost,IFNULL(c.thost,''))>'',ifnull(m.thost,c.thost) ,dstip) dstip," + 
    " if(ifnull(m.tport,IFNULL(c.tport,0))>0, ifnull(m.tport,c.tport), dstport) dstport,uri,method,sdata, rlen " +
    "FROM ttcppacket t join tmaster c on (t.tcode = c.code ) left join thostmap m on (t.tcode = m.tcode and t.appid = m.appid ) " +
    "where t.tcode = ? " + condi + " order by o_stime  " + vlimit, [param.tcode]);
  qstream.on("error", err => {
    console.log(PGNM, err); //if error
  });
  qstream.on("fields", meta => {
    // console.log(PGNM,meta); // [ ...]
  });
  qstream.on("data",  row => {
    cnt++ ;
    // qstream.pause();
    // (cnt+1) % 100 == 0 && console.log(PGNM, row.tcode, cnt, row.uri);
    if (param.interval > 0) {
      setTimeout( () => {
        dataHandle(row, (a = 0) => {  ucnt+=a } );
      }, param.interval);
    } else {
      dataHandle(row,(a = 0) => {  ucnt+=a } ) ;
    }
  });

  qstream.on("end", () => {
    console.log(PGNM, param.tcode, "*** read ended ***");

    let ival = setInterval(async () => {
      // console.log(PGNM, "@@ end check @@", tcnt, cnt);
      if ( ucnt >= tcnt) {
        clearInterval(ival);
        if (param.loop > 0) {
          console.log(PGNM, "loop");
          new module.exports(param);
        } else {
          if (!dbskip)
            await con.query('call sp_summary(?)', [param.tcode]);

          if (param.hasOwnProperty('jobId'))
            await con.query("UPDATE texecjob set resultstat = 9, msg = concat(msg,now(),':',?,'\r\n' ), endDt = now() where pkey = ? ",
              [cnt + " 건 수행", param.jobId]);
          console.log( `${cnt} read, ${ucnt} update`)
          process.exit(0);
        }
      }
    }, 2000);

  });
}

function dataHandle(rdata, cback ) {
  let stime = moment();
  let stimem = Math.ceil(process.hrtime()[1] / 1000);
  let sdataStr = rdata.sdata.toString();
  if (! /^(GET|POST|DELETE|PUT|PATCH)\s+(\S+)\s/s.test(sdataStr)) {
    return cback(1);
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
    return cback(1) ;
  }
  const options = {
    hostname: rdata.dstip,
    port: rdata.dstport,
    path: uri,
    method: rdata.method,
    timeout: aqttimeout,
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
        const re = new RegExp("http://.*?/");
        val = val.replace(re, "http://" + rdata.dstip + ':' + rdata.dstport + '/');
      }
      if (kv[0].length > 0) {
        options.headers[kv[0]] = val;
        new_shead += kv[0] + ': ' + val + '\r\n';
      }
    }
  };

  stime = moment();
  stimem = Math.ceil(process.hrtime()[1] / 1000);

  const req = http.request(options, function (res) {
    // stime = moment();
    // console.log(PGNM,'STATUS: ' + res.statusCode);
    // console.log(PGNM,'HEADERS: ' + JSON.stringify(res.headers));
    let resHs = 'HTTP/' + res.httpVersion + ' ' + res.statusCode + ' ' + res.statusMessage + "\r\n";
    for (const [key, value] of Object.entries(res.headers)) {
      resHs += `${key}: ${value}\r\n`;
      if (/set-cookie/i.test(key)) {
        saveCookie(rdata, `${value}`);
      }
    };

    // res.setEncoding('utf8');
    let recvData = [];
    // res.once('readable', () => {
    //   stime = moment() ;
    // }) ;
    res.on('data', function (chunk) {
      recvData.push(chunk);
    });
    res.on('end', () => {
      // console.log("* res end *",rdata.uri) ;
      if (dbskip) {
        console.log("skip ok",rdata.uri)
        return cback(1) ;
      }
      const rtime = moment();
      const rtimem = Math.ceil(process.hrtime()[1] / 1000);
      if (rtimem < stimem && stime.isSame(rtime, 'second')) rtime.add('1', 's');
      const svctime = moment.duration(rtime.diff(stime)).asSeconds() ;
      let rDatas = Buffer.concat(recvData);
      const rsz = res.headers['content-length'] || rDatas.length;

      // console.log(PGNM, stime.toSqlfmt(), rtime.toSqlfmt(), svctime, 'id=',rdata.pkey, 'rcv len=', rsz );
      // let new_d = Buffer.from(resdata,'binary') ;
       conp.query("UPDATE ttcppacket SET \
                    rdata = ?, sdata = ?, stime = ?, rtime = ?,  elapsed = ?, rcode = ? ,rhead = ?, rlen = ? ,cdate = now() where pkey = ? "
        , [rDatas, Buffer.from(new_shead), stime.toSqlfmt(stimem), rtime.toSqlfmt(rtimem), svctime, res.statusCode, resHs, rsz, rdata.pkey])
          .catch(err => console.error(PGNM, 'update error:', rdata.pkey, err) ) 
          .then(console.log("* update *",rdata.uri)) 
          .finally( cback(1) ) ;
    });
  });
  if (pi > 0 && /POST|PUT|DELETE|PATCH/.test(rdata.method)) {
    const sdata = sdataStr.slice(pi + 4);
    // console.log(PGNM,sdata.toString()) ;
    req.write(sdata);
    new_shead += '\r\n' + sdata.toString();
  }
  req.on('error', (e) => {
    console.error(PGNM, 'request: ', e.message, e.errno);
    const rtime = moment();
    const rtimem = Math.ceil(process.hrtime()[1] / 1000);

    const svctime = moment.duration(rtime.diff(stime)) / 1000.0;

    if (!dbskip)
      conp.query("UPDATE ttcppacket SET \
                      sdata = ?,  stime = ?, rtime = ?,  elapsed = ?, rcode = ? , rhead = ? , cdate = now() where pkey = ?"
        , [Buffer.from(new_shead), stime.toSqlfmt(stimem), rtime.toSqlfmt(rtimem), svctime, 999, e.message, rdata.pkey])
        ;
    cback(1) ;
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

function saveCookie(rdata, cook) {
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
  // ckMap.forEach((v,k) => console.log(k, v)) ;

}
