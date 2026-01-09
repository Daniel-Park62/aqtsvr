"use strict";

const MAX_RESP_LEN = 1024 * 32;
const PGNM = '[sendTcp]';

const moment = require('moment');
const iconv = require('iconv-lite');
const Net = require('net');
const ckMap = new Map();  // cookie 저장
const con = require('../db/db_con');

moment.prototype.toSqlfmt = function (ms) {
  return this.format('YYYY-MM-DD HH:mm:ss.' + ms);
};

let dbskip = false;

module.exports = function (param) {
  if (!param.loop) param.loop = 1;
  param.loop--;
  let tcnt = 0;
  let cnt = 0;
  let condi = param.cond > ' ' ? "and (" + param.cond + ")" : "";
  let vlimit = param.limit > ' ' ? ' LIMIT ' + param.limit : "";
  dbskip = param.dbskip;

  const qstr = "SELECT COUNT(*) cnt FROM ( select 1 from ttcppacket t where tcode = ? " + condi + vlimit + ") x";

  // if (param.limit > ' ') {
  //   tcnt = param.limit.split(',')[1] * 1  || param.limit * 1 ;
  //   console.log("%s Start 테스트id(%s) cond(%s) limit(%s) data건수 (%d) pid(%d)", PGNM, param.tcode, condi, vlimit, tcnt, process.pid);
  // } else
  con.query(qstr, [param.tcode])
    .then(row => {
      tcnt = row[0].cnt;
      console.log(PGNM, row[0], qstr);
      console.log("%s Start 테스트id(%s) cond(%s) limit(%s) data건수 (%d) pid(%d)", PGNM, param.tcode, condi, vlimit, tcnt, process.pid);
    })
    .catch(err => console.log(PGNM, err));
  con.getConnection().then(con2 => {
    const qstream = con2.queryStream("SELECT t.tcode, t.pkey,o_stime, if( ifnull(m.thost,IFNULL(c.thost,''))>'',ifnull(m.thost,c.thost) ,dstip) dstip, if(ifnull(m.tport,IFNULL(c.tport,0))>0, ifnull(m.tport,c.tport), dstport) dstport" +
      ",uri,method,sdata FROM ttcppacket t join tmaster c on (t.tcode = c.code ) left join thostmap m on (t.tcode = m.tcode and t.dstip = m.thost and t.dstport = m.tport) " +
      "where t.tcode = ? " + condi + " order by o_stime  " + vlimit, [param.tcode]);

    qstream.on("error", err => {
      console.log(PGNM, err); //if error
    });

    qstream.on("data", async row => {
      qstream.pause();
      cnt % 100 == 0 && console.log(PGNM, row.tcode, cnt.toLocaleString(), row.pkey);

      if (param.interval > 0) {
        setTimeout(async () => {
          await dataHandle(row, qstream).then(() => { cnt++; qstream.resume() });
        }, param.interval);
      } else {
        await dataHandle(row, qstream).then(() => { cnt++; qstream.resume() });
      }
      // cnt++ ;
    });

    qstream.on("end", () => {
      // console.log(PGNM, "@@ end check @@", tcnt, cnt);

      if (param.loop > 0) {
        console.log(PGNM, "Loop");
        module.exports(param);
      } else {
        waitend(0);
      }
    });

    function waitend(cc) {
      if (cnt < tcnt && cc < 10) {
        cc++;
        setTimeout(waitend, 1000, cc);
      } else {
        console.log(PGNM, param.tcode, "*** read ended ***");
        if (!dbskip) {
          con.query('call sp_summary(?)', [param.tcode]);
          con.query("UPDATE texecjob set resultstat = 2, msg = concat(msg, now(),':',?,'\r\n' ), endDt = now() where pkey = ?"
            , [" 총 " + cnt + " 건", param.jobkey]);
        }

        con.end();
      }
    }
  });

}

async function dataHandle(rdata, qstream) {
  let stime = moment();
  let stimem = Math.ceil(process.hrtime()[1] / 1000);
  let sdataStr = rdata.sdata.toString();
  let recvData = [];
  stime = moment();
  stimem = Math.ceil(process.hrtime()[1] / 1000);

  const port = 20000;
  const host = 'localhost';

  // Create a new TCP client.
  const client = new Net.Socket();
  // Send a connection request to the server.
  client.connect({ port: rdata.dstport, host: rdata.dstip });

  // The client can also receive data from the server by reading from its socket.
  client.on('data', function (chunk) {
    // console.log("Data received from the server: ", chunk.toString());
    recvData.push(chunk);
    // Request an end to the connection after the data has been received.
  });

  client.on('end', async function () {
    // console.log('Requested an end to the TCP connection');
    if (dbskip) {
      // qstream.resume();
      return;
    }
    const rtime = moment();
    const rtimem = Math.ceil(process.hrtime()[1] / 1000);
    if (rtimem < stimem && stime.isSame(rtime, 'second')) rtime.add('1', 's');
    const svctime = moment.duration(rtime.diff(stime)) / 1000.0;
    // recvData[0] = bufTrim(recvData[0]);
    let rDatas = Buffer.concat(recvData);
    const rsz = rDatas.length;

    await con.query("UPDATE ttcppacket SET \
						rdata = ?, stime = ?, rtime = ?,  elapsed = ?, rcode = ? ,rlen = ? ,cdate = now() where pkey = ? "
      , [rDatas, stime.toSqlfmt(stimem), rtime.toSqlfmt(rtimem), svctime, 1, rsz, rdata.pkey])
      .catch(err => {
        console.error(PGNM, 'update error:', rdata.pkey, err);
      });
    // qstream.resume();

  });

  client.on('error', async function (e) {
    // console.error(PGNM, 'Problem with request: ', e.message, e.errno);
    const rtime = moment();
    const rtimem = Math.ceil(process.hrtime()[1] / 1000);

    const svctime = moment.duration(rtime.diff(stime)) / 1000.0;

    if (!dbskip)
      await con.query("UPDATE ttcppacket SET \
						stime = ?, rtime = ?,  elapsed = ?, rcode = ? , errinfo = ? , cdate = now() where pkey = ?"
        , [stime.toSqlfmt(stimem), rtime.toSqlfmt(rtimem), svctime, 999, e.message, rdata.pkey])
        .catch(err => {
          console.error('update error:', err);
        });
    // qstream.resume();

  });

  client.write(rdata.sdata);
  client.end();
  return "";
}
