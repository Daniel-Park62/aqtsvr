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
let mybns = checkCon(0) ;

// console.log("thread id:",threadId, param);
parentPort.on('message',async (pkey) => {
  if (!con.isValid()) con = await require('../db/db_con1');
  mybns = checkCon(mybns) ;
  con.query("SELECT t.tcode, t.pkey,o_stime,c.appid, if( ifnull(m.thost2,IFNULL(c.thost,''))>'',ifnull(m.thost2,c.thost) ,dstip) dstip," +
    " if(ifnull(m.tport2,IFNULL(c.tport,0))>0, ifnull(m.tport2,c.tport), dstport) dstport,uri,sdata, rlen " +
    "FROM ttcppacket t join tmaster c on (t.tcode = c.code ) left join thostmap m on (t.tcode = m.tcode and t.dstip = m.thost and t.dstport = m.tport) " +
    "where t.pkey = ? ", [pkey])
    .then(rdata => dataHandle(rdata[0]));
});

function checkCon(id) {
  if (id > 0) clearInterval(id);
  return setInterval(() => {
    con.query('select 1');
  }, 30 * 60 * 1000) ;
}
function dataHandle(rdata) {
  let recvData = [];
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
    if (chunk.length === 0)  client.end() ;
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
    if (rsz > 6 && rDatas.readUInt16BE() == 0x4142 && rDatas.readUInt8(4) == 4) rcd = rDatas.readUInt16BE(5) ;
    con.query("UPDATE ttcppacket SET \
						rdata = ?, sdata = ?, stime = ?, rtime = ?,  elapsed = ?, rcode = ? ,rlen = ? ,cdate = now() where pkey = ? "
      , [rDatas, rdata.sdata, stime.toSqlfmt(stimem), rtime.toSqlfmt(rtimem), svctime, rcd, rsz, rdata.pkey])
      .catch(err => {
        console.error(PGNM,(new Date()).toLocaleString(), 'update error:', rdata.pkey, err);
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
          console.error(PGNM,(new Date()).toLocaleString(),'update error:', err);
        });
    parentPort.postMessage({ err: 1 });
  });
  
  
  if ( rdata.appid == 'JDY' && ( rdata.dstport === 7575 || rdata.dstport === 7675 )) {
    let ndate = moment().add(-1,"s").format("YYYYMMDDHHmmssSSS") ;
    let ndate2 = Buffer.from(rdata.sdata.slice(38,50)) ;
    rdata.sdata.write(ndate,38) ;
    let ix = 55 ;
    ndate = ndate.substr(0,12) ;
//	  console.log(ndate, ndate2);
    while( ix < rdata.sdata.length ) {
      ix = rdata.sdata.indexOf(ndate2,ix) ;
      if (ix == -1) break ;
      rdata.sdata.write(ndate,ix) ;
      ix += 12 ;
    }
//    console.log("ndate2", ndate2);
    
  } else  if ( rdata.appid == 'JDY' && ( rdata.dstport === 7576 || rdata.dstport === 7676 )) {
    let ndate = moment().add(-1,"s").format("YYYYMMDDHHmmssSSS") ;
    let ndate2 = Buffer.from(rdata.sdata.slice(38,50)) ;
    rdata.sdata.write(ndate,38) ;
    rdata.sdata.write(ndate,4) ;
    let ix = 55 ;
    ndate = ndate.substr(0,12) ;
    while( ix < rdata.sdata.length ) {
      ix = rdata.sdata.indexOf(ndate2,ix) ;
      if (ix == -1) break ;
      rdata.sdata.write(ndate,ix) ;
      ix += 12 ;
    }
//    console.log("ndate2", ndate2);
  }  
  
//  client.write(rdata.sdata);
  writeData(client, rdata.sdata) ;
	if ( rdata.appid == 'VVZ' || rdata.appid == 'MKP' || rdata.appid == 'JDZ' ||   rdata.appid == 'EZZ'  )
  		; // setTimeout( () => client.end(),  50000 );
	else
		client.end();
   
  function writeData(sock, data) {
    let ret = !sock.write(data) ;
    if (!ret) {
      (function(sock,data){
        sock.once('drain', function() {
          writeData(sock,data) ;
        });
      })(sock,data) ;
    }
  }
}
process.on('SIGINT', parentPort.close);