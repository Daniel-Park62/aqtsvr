
"use strict";

const Net = require('net');
const cParser = require('./cookParser') ;
const logger = require('./logs/aqtLogger').child({label:'tcpRequest'});
const mdb = require('../db/db_con1');
let con;

process.on('SIGTERM', endProc);
process.on('uncaughtException', (err) => { logger.error(err) });

(async () => {
  con = await mdb;
  process.send({ ready: 1 });
})();

const param = JSON.parse(process.argv[2]) ;
// let mybns = checkCon(0) ;
let ckexists = 0;
// logger.info( param);

function endProc() {
  if (con)  con.end() ;
  process.exit(0);
}
process.on('message', async (pkey) => {
  if (pkey?.svCook) {
    cParser.saveCookie(pkey.svCook, pkey.svKey);
    ckexists = 1;
    return;
  }
  // if (!con.isValid()) con = await mdb;
  con.ping().catch(async err => {
    logger.error(err);
    await con.end();
    con = await mdb ;
  });

  // mybns = checkCon(mybns) ;
  con.query("SELECT t.tcode, t.pkey,o_stime,c.appid, if( ifnull(m.thost,IFNULL(c.thost,''))>'',ifnull(m.thost,c.thost) ,dstip) dstip," +
    " if(ifnull(m.tport,IFNULL(c.tport,0))>0, ifnull(m.tport,c.tport), dstport) dstport,uri,sdata, slen " +
    "FROM ttcppacket t join tmaster c on (t.tcode = c.code ) left join thostmap m on (t.tcode = m.tcode and t.appid = m.appid ) " +
    "where t.pkey = ? ", [pkey])
    .then(rdata => dataHandle(rdata[0]))
    .catch(err => {
      logger.error(`select error:${pkey} ${err}`);
      process.send({ err: 1 });
  });

});

function checkCon(id) {
  if (id > 0) clearInterval(id);
  return setInterval(() => {
    con.query('select 1');
  }, 10 * 60 * 1000) ;
}
function dataHandle(rdata) {
  let recvData = [];
  const stimem = performance.now();
  const stime = (new Date()).getTime() / 1000 ;
  // Create a new TCP client.

  const client = new Net.Socket();
  // Send a connection request to the server.
  if ( param.saup !== undefined && param.saup.localip ) 
    client.connect({ port: param.saup.port, host: param.saup.hostip, localAddress: param.saup.localip });
  else
  	client.connect({ port: rdata.dstport, host: rdata.dstip });

  client.setTimeout(param.aqttimeout + 0);
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
      process.send({ ready: 1 });
      return;
    }
    const rtimem = performance.now();
    const svctime = (rtimem - stimem) / 1000 ;
    const rtime = stime + svctime ;

    let rDatas = Buffer.concat(recvData);
    const rsz = rDatas.length;
    let rcd = 1;
    if (rsz > 6 && rDatas.readUInt16BE() == 0x4142 && rDatas.readUInt8(4) == 4) {
      rcd = rDatas.readUInt16BE(5) ;
      ajp_parser(rDatas) ;
    }
    con.query("UPDATE ttcppacket SET \
                      rdata = ?, sdata = ?, stime = from_unixtime(?), rtime = from_unixtime(?),  elapsed = ?, rcode = ? ,rlen = ? ,cdate = now() where pkey = ? "
      , [rDatas, rdata.sdata, stime, rtime, svctime, rcd, rsz, rdata.pkey])
      .catch(err => {
        logger.error(`update error: ${rdata.pkey} ${err}`);
        process.send({ err: 1 });
      })
      .then(process.send({ ok: 1 }));
  });
  client.on('error', function (e) {
    const rtimem = performance.now();
    const svctime = (rtimem - stimem) / 1000 ;
    const rtime = stime + svctime ;

    if (!param.dbskip)
      con.query("UPDATE ttcppacket SET \
                       sdata = ?, stime = from_unixtime(?), rtime = from_unixtime(?),  elapsed = ?, rcode = ? , errinfo = ? , cdate = now() where pkey = ?"
        , [rdata.sdata, stime, rtime, svctime, 999, e.message, rdata.pkey])
        .catch(err => {
          logger.error(`update error: ${err} `);
        });
    process.send({ err: 1 });
  });


  if ( ckexists && rdata.slen > 40 && rdata.sdata.readUInt16BE() == 0x1234 && rdata.sdata.readUInt8(4) == 2) {

    let sHead = rdata.sdata.subarray(0,rdata.sdata.readUInt16BE(2)+4) ;
    let sData2 = rdata.sdata.subarray(rdata.sdata.readUInt16BE(2)+4,) ;
    let sz = sHead.readUInt16BE(6) ;
    let p1 = 8 + sz + 1 ;
    let p2 = (  sHead.readUInt16BE(p1) + 3 + p1) ;
          // console.log('p1-1:',p2, 'ckval.length',ckval.length , ckvalstr ) ;
    let p3 = (  sHead.readUInt16BE(p2) + 3 + p2) ;
          // console.log('p1-2:',p3) ;
    let p4 = p3 + 2;
          // console.log('p1-3:',p4) ;
    let p5 = ( sHead.readUInt16BE(p4) + 3 + p4 ) ;
          // console.log('p1-4:',p5) ;
    let p6 = p5 + 3
          // console.log('p1-4:',p6) ;
    let hcnt = sHead.readUInt16BE(p6) ;
          // console.log('hcnt:',hcnt) ;
          p6 += 2;
    let hnm ;
         if ( p6 < 1355)
    for (let i=0; i<hcnt; ) {
            let p7 = p6+2 ;
        //    console.log(p6,p7) ;
            if (p7 > 1355) break ;

      sz = sHead.readUInt8(p6) ;
      if ( sz == 0xA0 ) {
        i++;
        hnm = sHead.subarray(p6,p7) ;
        sz = sHead.readUInt16BE(p7) ;
            // console.log(hnm,sz) ;
        if ( hnm.readUInt16BE()  == 0xA009 ) {
//                 console.log(sz,'[[',sHead.subarray(p7+2,p7+2+sz).toString(),']]' ) ;
          let sa009 = Buffer.from(cParser.change_cookie( sHead.subarray(p7+2,p7+2+sz).toString(),
                                  rdata.dstip+":"+rdata.dstport, rdata.uri)
                              ) ;
                  sa009 = Buffer.concat([sHead.subarray(p6,p6+4),sa009],sa009.length + 5) ;
          sa009.writeUInt16BE( sa009.length - 5,2 ) ;
//                              console.log('(',sa009.toString(),')');
          sHead = Buffer.concat([sHead.subarray(0,p6), sa009,sHead.subarray(p6+5+sz,) ]) ;
//              console.log('len:',sHead.length, sHead.subarray(sHead.length -4,sHead.length) ) ;
          sHead.writeUInt16BE(sHead.length - 4,2 ) ;
                  rdata.sdata = Buffer.concat([sHead, sData2]) ;
          break ;
        }   else {
              p6 += ( sz+5 );
                }
       } else if (sz === 0xFF ) {
                           break ;
           } else {
         sz = sHead.readUInt16BE(p6) ;
                 p6 += (sz + 3) ;
           }
    }

  }

//  client.write(rdata.sdata);
  writeData(client, rdata.sdata) ;
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

  function ajp_parser(ajpd) {
    if (!( ajpd.readUInt16BE() == 0x4142 && ajpd.readUInt16BE(2) > 11 && ajpd.readUInt8(4) == 4 )) return ;
    let p1 = ajpd.readUInt16BE(7) + 1 + 9 ; // status msg 위치 9부터 길이만큼
    let hcnt = ajpd.readUInt16BE(p1) ;
    p1 +=  2;
          console.log('ajp parser hcnt:', hcnt) ;
    for (let ii=1; ii<hcnt ; ii++) {
      if ( ajpd.readUInt8(p1) != 0xA0 ) {
              p1 += ( ajpd.readUInt16BE(p1) + 3 ) ;
              continue ;
      }
      let hnm = ajpd.subarray(p1,p1+2) ;
      let hsz = ajpd.readUInt16BE(p1+2) ;
//        console.log(hnm,hsz,p1) ;
      if ( hnm.readUInt16BE() == 0xA007 )  {
        process.send({ svCook: ajpd.subarray(p1+4, p1+4+hsz).toString(), svKey: rdata.dstip+":"+rdata.dstport});
//              console.log({ svCook: ajpd.subarray(p1+4, p1+4+hsz).toString(), svKey: rdata.dstip+":"+rdata.dstport});
        break ;
      } else {
        p1 += ( hsz + 5);
      }
    }
  }

}
