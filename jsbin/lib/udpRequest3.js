"use strict";

const dgram = require('dgram');
const PGNM = '[udpRequest3] ';

let con;
(async () => {
  con = await require('../db/db_con1');
  // console.log(threadId,"db connected") ;
  process.on('SIGTERM', con.end);
  process.send({ ready: 1 });
})();

const param = JSON.parse(process.argv[2]) ;

// console.log("thread id:",threadId, param);

process.on('message', (pkey) => {

  con.query("SELECT t.tcode, t.pkey,o_stime, if( ifnull(m.thost2,IFNULL(c.thost,''))>'',ifnull(m.thost2,c.thost) ,dstip) dstip," +
    " if(ifnull(m.tport2,IFNULL(c.tport,0))>0, ifnull(m.tport2,c.tport), dstport) dstport,uri,sdata, rlen " +
    "FROM ttcppacket t join tmaster c on (t.tcode = c.code ) left join thostmap m on (t.tcode = m.tcode and t.dstip = m.thost and t.dstport = m.tport) " +
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
        console.error(PGNM,'update error:', rdata.pkey, err);
        process.send({ err: 1 });
      })
      .then(process.send({ ok: 1 }));

    client.close();
  });

}

