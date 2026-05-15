"use strict";

const dgram = require('dgram');
const logger = require('./logs/aqtLogger').child({ label: 'udpRequest' });
const mdb = require('../db/db_con1');

let con;

process.on('SIGTERM', endProc);
process.on('uncaughtException', (err) => { logger.error(err) });

(async () => {
  con = await mdb.getCon();
  process.send({ ready: 1 });
})();

const param = JSON.parse(process.argv[2]) ;
const funcBefore = param.func2 ? new Function('xargs', param.func2) : null;
const funcAfter = param.func3 ? new Function('xargs', param.func3) : null;

process.on('message', (pkey) => {
  con.ping().catch(async err => {
    logger.error(err);
    await con.end();
    con = await mdb.getCon();
  });

  con.query(`SELECT t.tcode, t.pkey,o_stime, if( IFNULL(thost,'')>'',thost ,dstip) dstip,
            if(IFNULL(tport,0)>0, tport, dstport) dstport,uri,sdata, rlen 
        FROM vtcppacket t  where t.pkey = ? `, [pkey])
    .then(rdata => dataHandle(rdata[0]));

});

function dataHandle(rdata) {
  if (funcBefore) funcBefore(rdata);
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
      con.query("UPDATE vpacket SET \
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

