
"use strict";
const { parentPort, threadId, workerData } = require('worker_threads');
const moment = require('moment');
const Net = require('net');
const cParser = require('./cookParser');
const PGNM = '[tcpRequest]';
const cdate = () => "[tcpRequest] " + moment().format("MM/DD HH:mm:ss.SSS :");
moment.prototype.toSqlfmt = function (ms) {
  return this.format('YYYY-MM-DD HH:mm:ss.' + ms);
};
let con;
(async () => {
  con = await require('../db/db_con1');
  // console.log(threadId,"db connected") ;
  process.on('SIGTERM', con.end);
  parentPort.postMessage({ ready: 1 });
  setInterval(() => { con.query('select 1 ') }, 300 * 1000);
})();
const param = workerData;
let mybns = checkCon(0);
let ckexists = 0;
// console.log("thread id:",threadId, param);
parentPort.on('message', async (pkey) => {

  if (!con.isValid()) con = await require('../db/db_con1');
  if (pkey?.svCook) {
    cParser.saveCookie(pkey.svCook, pkey.svKey);
    ckexists = 1;
    return;
  }

  mybns = checkCon(mybns);
  con.query("SELECT t.tcode, t.pkey,o_stime,c.appid, if( ifnull(m.thost,IFNULL(c.thost,''))>'',ifnull(m.thost,c.thost) ,dstip) dstip," +
    " if(ifnull(m.tport,IFNULL(c.tport,0))>0, ifnull(m.tport,c.tport), dstport) dstport,uri,sdata, slen " +
    "FROM ttcppacket t join tmaster c on (t.tcode = c.code ) left join thostmap m on (t.tcode = m.tcode and t.appid = m.appid) " +
    "where t.pkey = ? ", [pkey])
    .then(rdata => dataHandle(rdata[0]))
    .catch(err => {
      console.error(cdate(), 'select error:', pkey, err);
      parentPort.postMessage({ err: 1 });
    });

});

function checkCon(id) {
  if (id > 0) clearInterval(id);
  return setInterval(() => {
    con.query('select 1');
  }, 10 * 60 * 1000);
}
function dataHandle(rdata) {
  let recvData = [];
  let stime = moment();
  let stimem = Math.floor(process.hrtime()[1] / 1000);
  // Create a new TCP client.

  const client = new Net.Socket();
  // Send a connection request to the server.
  if (param.saup !== undefined && param.saup.localip)
    client.connect({ port: param.saup.port, host: param.saup.hostip, localAddress: param.saup.localip });
  else
    client.connect({ port: rdata.dstport, host: rdata.dstip });

  console.info(rdata.dstport, rdata.dstip ) ;
  client.setTimeout(param.aqttimeout);
  client.on('timeout', () => {
    // console.log(PGNM,'socket timeout');
    client.emit('error', new Error('client timeout'));
    client.end();
  });
  client.on('data', function (chunk) {
    // console.log("Data received from the server: ", chunk.toString());
    recvData.push(chunk);
    if (chunk.length === 0) client.end();
    // Request an end to the connection after the data has been received.
  });
  client.on('end', function () {
    // console.log('Requested an end to the TCP connection');
    if (param.dbskip) {
      // console.log("skip ok", rdata.uri)
      parentPort.postMessage({ ready: 1 });
      return;
    }
    const rtimem = Math.ceil(process.hrtime()[1] / 1000);
    const rtime = moment();
    if (rtimem < stimem && stime.isSameOrAfter(rtime, 'second')) rtime.add('1', 's');
    const svctime = moment.duration(rtime.diff(stime)).asSeconds();
    // recvData[0] = bufTrim(recvData[0]);
    let rDatas = Buffer.concat(recvData);
    const rsz = rDatas.length;
    let rcd = 1;
    if (rsz > 6 && rDatas.readUInt16BE() == 0x4142 && rDatas.readUInt8(4) == 4) {
      rcd = rDatas.readUInt16BE(5);
      ajp_parser(rDatas);
    }
    con.query("UPDATE ttcppacket SET \
                                                rdata = ?, sdata = ?, stime = ?, rtime = ?,  elapsed = ?, rcode = ? ,rlen = ? ,cdate = now() where pkey = ? "
      , [rDatas, rdata.sdata, stime.toSqlfmt(stimem), rtime.toSqlfmt(rtimem), svctime, rcd, rsz, rdata.pkey])
      .catch(err => {
        console.error(PGNM, (new Date()).toLocaleString(), 'update error:', rdata.pkey, err);
        parentPort.postMessage({ err: 1 });
      })
      .then(parentPort.postMessage({ ok: 1 }));
  });
  client.on('error', function (e) {
    const rtime = moment();
    const rtimem = Math.ceil(process.hrtime()[1] / 1000);
    if (rtimem < stimem && stime.isSameOrAfter(rtime, 'second')) rtime.add('1', 's');
    const svctime = moment.duration(rtime.diff(stime)).asSeconds();
    if (!param.dbskip)
      con.query("UPDATE ttcppacket SET \
                                                sdata = ?, stime = ?, rtime = ?,  elapsed = ?, rcode = ? , errinfo = ? , cdate = now() where pkey = ?"
        , [rdata.sdata, stime.toSqlfmt(stimem), rtime.toSqlfmt(rtimem), svctime, 999, e.message, rdata.pkey])
        .catch(err => {
          console.error(PGNM, (new Date()).toLocaleString(), 'update error:', err);
        });
    parentPort.postMessage({ err: 1 });
  });


  if (rdata.appid == 'JDY' && (rdata.dstport === 7575 || rdata.dstport === 7675)) {
    let ndate = moment().add(-1, "s").format("YYYYMMDDHHmmssSSS");
    let ndate2 = Buffer.from(rdata.sdata.slice(38, 50));
    rdata.sdata.write(ndate, 38);
    let ix = 55;
    ndate = ndate.substr(0, 12);
    //        console.log(ndate, ndate2);
    while (ix < rdata.sdata.length) {
      ix = rdata.sdata.indexOf(ndate2, ix);
      if (ix == -1) break;
      rdata.sdata.write(ndate, ix);
      ix += 12;
    }
    //    console.log("ndate2", ndate2);

  } else if (rdata.appid == 'JDY' && (rdata.dstport === 7576 || rdata.dstport === 7676)) {
    let ndate = moment().add(-1, "s").format("YYYYMMDDHHmmssSSS");
    let ndate2 = Buffer.from(rdata.sdata.slice(38, 50));
    rdata.sdata.write(ndate, 38);
    rdata.sdata.write(ndate, 4);
    let ix = 55;
    ndate = ndate.substr(0, 12);
    while (ix < rdata.sdata.length) {
      ix = rdata.sdata.indexOf(ndate2, ix);
      if (ix == -1) break;
      rdata.sdata.write(ndate, ix);
      ix += 12;
    }
    //    console.log("ndate2", ndate2);
  }

  if (ckexists && rdata.slen > 40 && rdata.sdata.readUInt16BE() == 0x1234 && rdata.sdata.readUInt8(4) == 2) {

    let sHead = rdata.sdata.subarray(0, rdata.sdata.readUInt16BE(2) + 4);
    let sData2 = rdata.sdata.subarray(rdata.sdata.readUInt16BE(2) + 4,);
    let sz = sHead.readUInt16BE(6);
    let p1 = 8 + sz + 1;
    let p2 = (sHead.readUInt16BE(p1) + 3 + p1);
    // console.log('p1-1:',p2, 'ckval.length',ckval.length , ckvalstr ) ;
    let p3 = (sHead.readUInt16BE(p2) + 3 + p2);
    // console.log('p1-2:',p3) ;
    let p4 = p3 + 2;
    // console.log('p1-3:',p4) ;
    let p5 = (sHead.readUInt16BE(p4) + 3 + p4);
    // console.log('p1-4:',p5) ;
    let p6 = p5 + 3
    // console.log('p1-4:',p6) ;
    let hcnt = sHead.readUInt16BE(p6);
    // console.log('hcnt:',hcnt) ;
    p6 += 2;
    let hnm;
    if (p6 < 1355)
      for (let i = 0; i < hcnt;) {
        let p7 = p6 + 2;
        //    console.log(p6,p7) ;
        if (p7 > 1355) break;

        sz = sHead.readUInt8(p6);
        if (sz == 0xA0) {
          i++;
          hnm = sHead.subarray(p6, p7);
          sz = sHead.readUInt16BE(p7);
          // console.log(hnm,sz) ;
          if (hnm.readUInt16BE() == 0xA009) {
            //                 console.log(sz,'[[',sHead.subarray(p7+2,p7+2+sz).toString(),']]' ) ;
            let sa009 = Buffer.from(cParser.change_cookie(sHead.subarray(p7 + 2, p7 + 2 + sz).toString(),
              rdata.dstip + ":" + rdata.dstport, rdata.uri)
            );
            sa009 = Buffer.concat([sHead.subarray(p6, p6 + 4), sa009], sa009.length + 5);
            sa009.writeUInt16BE(sa009.length - 5, 2);
            //                              console.log('(',sa009.toString(),')');
            sHead = Buffer.concat([sHead.subarray(0, p6), sa009, sHead.subarray(p6 + 5 + sz,)]);
            //              console.log('len:',sHead.length, sHead.subarray(sHead.length -4,sHead.length) ) ;
            sHead.writeUInt16BE(sHead.length - 4, 2);
            rdata.sdata = Buffer.concat([sHead, sData2]);
            break;
          } else {
            p6 += (sz + 5);
          }
        } else if (sz === 0xFF) {
          break;
        } else {
          sz = sHead.readUInt16BE(p6);
          p6 += (sz + 3);
        }
      }

  }

  //  client.write(rdata.sdata);
  console.info('recv ', rdata.sdata);
  writeData(client, rdata.sdata);

  if (rdata.appid == 'VVZ' || rdata.appid == 'MKP' || rdata.appid == 'JDZ' || rdata.appid == 'EZZ')
    ; // setTimeout( () => client.end(),  50000 );
  else
    client.end();

  function writeData(sock, data) {
    const ret = !sock.write(data);
    if (!ret) {
      (function (sock, data) {
        sock.once('drain', function () {
          writeData(sock, data);
        });
      })(sock, data);
    }
  }

  function ajp_parser(ajpd) {
    if (!(ajpd.readUInt16BE() == 0x4142 && ajpd.readUInt16BE(2) > 11 && ajpd.readUInt8(4) == 4)) return;
    let p1 = ajpd.readUInt16BE(7) + 1 + 9; // status msg 위치 9부터 길이만큼
    let hcnt = ajpd.readUInt16BE(p1);
    p1 += 2;
    console.log('ajp parser hcnt:', hcnt);
    for (let ii = 1; ii < hcnt; ii++) {
      if (ajpd.readUInt8(p1) != 0xA0) {
        p1 += (ajpd.readUInt16BE(p1) + 3);
        continue;
      }
      let hnm = ajpd.subarray(p1, p1 + 2);
      let hsz = ajpd.readUInt16BE(p1 + 2);
      //        console.log(hnm,hsz,p1) ;
      if (hnm.readUInt16BE() == 0xA007) {
        parentPort.postMessage({ svCook: ajpd.subarray(p1 + 4, p1 + 4 + hsz).toString(), svKey: rdata.dstip + ":" + rdata.dstport });
        //              console.log({ svCook: ajpd.subarray(p1+4, p1+4+hsz).toString(), svKey: rdata.dstip+":"+rdata.dstport});
        break;
      } else {
        p1 += (hsz + 5);
      }
    }
  }

}

process.on('SIGINT', parentPort.close);
