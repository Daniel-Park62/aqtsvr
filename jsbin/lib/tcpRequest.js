"use strict";

const { parentPort, threadId, workerData } = require('worker_threads');
const moment = require('moment');
const Net = require('net');
const PGNM = '[tcpRequest]';

moment.prototype.toSqlfmt = function (ms) {
  return this.format('YYYY-MM-DD HH:mm:ss.' + ms);
};

let con;
(async () => {
  con = await require('../db/db_con1');
  // console.log(threadId,"db connected") ;
  process.on('SIGTERM', con.end);
  parentPort.postMessage({ ready: 1 });
})();

let param = workerData;

// console.log("thread id:",threadId, param);

parentPort.on('message', (pkey) => {

  // console.log(pkey) ;
  con.query("SELECT t.tcode, t.pkey,o_stime, if( ifnull(m.thost2,IFNULL(c.thost,''))>'',ifnull(m.thost2,c.thost) ,dstip) dstip," +
    " if(ifnull(m.tport2,IFNULL(c.tport,0))>0, ifnull(m.tport2,c.tport), dstport) dstport,uri,sdata, rlen " +
    "FROM ttcppacket t join tmaster c on (t.tcode = c.code ) left join thostmap m on (t.tcode = m.tcode and t.dstip = m.thost and t.dstport = m.tport) " +
    "where t.pkey = ? ", [pkey])
    .then(rdata => dataHandle(rdata[0]));

});

function dataHandle(rdata) {

  let stime = moment();
  let stimem = Math.floor(process.hrtime()[1] / 1000);
  // Create a new TCP client.
  const client = new Net.Socket();
  // Send a connection request to the server.
  client.connect({ port: rdata.dstport, host: rdata.dstip });

  client.setTimeout(param.aqttimeout);
  client.on('timeout', () => {
    // console.log(PGNM,'socket timeout');
    client.emit('error', new Error('client timeout')) ;
    client.end();
  });
  client.on('data', function (chunk) {
    // console.log("Data received from the server: ", chunk.toString());
    recvData.push(chunk);
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

    con.query("UPDATE ttcppacket SET \
						rdata = ?, stime = ?, rtime = ?,  elapsed = ?, rcode = ? ,rlen = ? ,cdate = now() where pkey = ? "
      , [rDatas, stime.toSqlfmt(stimem), rtime.toSqlfmt(rtimem), svctime, 1, rsz, rdata.pkey])
      .catch(err => {
        console.error(PGNM,'update error:', rdata.pkey, err);
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
						stime = ?, rtime = ?,  elapsed = ?, rcode = ? , errinfo = ? , cdate = now() where pkey = ?"
        , [stime.toSqlfmt(stimem), rtime.toSqlfmt(rtimem), svctime, 999, e.message, rdata.pkey])
        .catch(err => {
          console.error(PGNM,'update error:', err);
        });
    parentPort.postMessage({ err: 1 });

  });

  client.write(rdata.sdata);
  client.end();

}

process.on('SIGINT', parentPort.close);

