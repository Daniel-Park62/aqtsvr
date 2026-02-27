"use strict";

const dgram = require('dgram');
const logger = require('./logs/aqtLogger').child({ label: 'udpRequest' });
const mdb = require('../db/db_con1');

let con;

process.on('SIGTERM', endProc);
process.on('uncaughtException', (err) => { logger.error(err) });

(async () => {
  con = await mdb;
  process.send({ ready: 1 });
})();

const param = JSON.parse(process.argv[2]) ;

// console.log("thread id:",threadId, param);

process.on('message', (pkey) => {
  con.ping().catch(async err => {
    logger.error(err);
    await con.end();
    con = await mdb ;
  });

  con.query("SELECT t.tcode, t.pkey,o_stime, if( ifnull(m.thost,IFNULL(c.thost,''))>'',ifnull(m.thost,c.thost) ,dstip) dstip," +
    " if(ifnull(m.tport,IFNULL(c.tport,0))>0, ifnull(m.tport,c.tport), dstport) dstport,uri,sdata, rlen " +
    "FROM ttcppacket t join tmaster c on (t.tcode = c.code ) left join thostmap m on (t.tcode = m.tcode and t.appid = m.appid ) " +
    "where t.pkey = ? ", [pkey])
    .then(rdata => dataHandle(rdata[0]));

});

function dataHandle(rdata) {
  let recvData = [];
  const stimem = performance.now();
  const stime = (new Date()).getTime() / 1000 ;
  // Create a new UDP client.
  const client = dgram.createSocket("udp4");
  // Send a connection request to the server.

  client.send(rdata.sdata, 0, rdata.sdata.length , rdata.dstport, rdata.dstip, function(err, bytes) {
    const rtimem = performance.now();
    const svctime = (rtimem - stimem) / 1000 ;
    const rtime = stime + svctime ;
    let errmsg = '';
    let rcd = 1;
    if (err) {
      errmsg = err.message ;
      rcd = 999 ;
    }
    if (!param.dbskip) 
      con.query("UPDATE ttcppacket SET \
						rcode= ?, errinfo = ?, stime = from_unixtime(?), rtime = from_unixtime(?),  elapsed = ?, rcode = 1 ,cdate = now() where pkey = ? "
      , [ rcd, errmsg, stime, rtime, svctime,  rdata.pkey])
      .catch(err => {
        console.error('update error:', rdata.pkey, err);
        process.send({ err: 1 });
      })
      .then(process.send({ ok: 1 }));

    client.close();
  });

}

