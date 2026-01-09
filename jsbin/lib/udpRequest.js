"use strict";

const { parentPort, threadId, workerData } = require('worker_threads');
const moment = require('moment');
//const Net = require('net');
const dgram = require('dgram');
const PGNM = '[udpRequest]';

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

  con.query("SELECT t.tcode, t.pkey,o_stime, if( ifnull(m.thost,IFNULL(c.thost,''))>'',ifnull(m.thost,c.thost) ,dstip) dstip," +
    " if(ifnull(m.tport,IFNULL(c.tport,0))>0, ifnull(m.tport,c.tport), dstport) dstport,uri,sdata, rlen " +
    "FROM ttcppacket t join tmaster c on (t.tcode = c.code ) left join thostmap m on (t.tcode = m.tcode and t.appid = m.appid ) " +
    "where t.pkey = ? ", [pkey])
    .then(rdata => dataHandle(rdata[0]));

});

function dataHandle(rdata) {
  let recvData = [];
  let stime = moment();
  let stimem = Math.floor(process.hrtime()[1] / 1000);
  // Create a new UDP client.
  const client = dgram.createSocket("udp4");
  // Send a connection request to the server.

  client.send(rdata.sdata, 0, rdata.sdata.length , rdata.dstport, rdata.dstip, function(err, bytes) {
    const rtimem = Math.ceil(process.hrtime()[1] / 1000);
    const rtime = moment();
    if (rtimem < stimem && stime.isSameOrAfter(rtime, 'second')) rtime.add('1', 's');
    const svctime = moment.duration(rtime.diff(stime)).asSeconds();
    let errmsg = '';
    let rcd = 1;
    if (err) {
      errmsg = err.message ;
      rcd = 999 ;
    }
    if (!param.dbskip) 
      con.query("UPDATE ttcppacket SET \
						rcode= ?, errinfo = ?, stime = ?, rtime = ?,  elapsed = ?, rcode = 1 ,cdate = now() where pkey = ? "
      , [ rcd, errmsg, stime.toSqlfmt(stimem), rtime.toSqlfmt(rtimem), svctime,  rdata.pkey])
      .catch(err => {
        console.error(PGNM,'update error:', rdata.pkey, err);
        parentPort.postMessage({ err: 1 });
      })
      .then(parentPort.postMessage({ ok: 1 }));

    client.close();
  });

}

process.on('SIGINT', parentPort.close);

