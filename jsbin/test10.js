/*
  { tcode, loop , cond, limit, dbskip, interval,jobId }
*/

"use strict";

const MAX_RESP_LEN = 1024 * 32;

let con = null;
let dbskip = false;

module.exports = function (param) {
  con = param.conn;
  let tcnt = 0;
  let cnt = 0;
  let ucnt = 0;
  let ecnt = 0;

  const threads = new Array();
  
  dbskip = param.dbskip;
  thread_start(param);
  const qstr = "SELECT COUNT(*) cnt FROM ( select 1 from ttcppacket t where tcode = ? limit 100 ) x";

  con.query(qstr, [param.tcode])
    .then(row => {
      tcnt = Number(row[0].cnt);
      console.log("%s Start 테스트id(%s) data건수(%d) pid(%d)"
        , PGNM, param.tcode,  tcnt, process.pid);
    })
    .catch(err => console.log(PGNM, qstr, err));

  const qstream = con.queryStream("SELECT t.pkey,o_stime " +
    "FROM ttcppacket t join tmaster c on (t.tcode = c.code ) left join thostmap m on (t.tcode = m.tcode and t.appid = m.appid ) " +
    "where t.tcode = ?  order by o_stime limit 100 " , [param.tcode]);

  qstream.on("error", err => {
    console.log(PGNM, err); //if error
  });
  qstream.on("fields", meta => {
    // console.log(PGNM,meta); // [ ...]
  });
  qstream.on("data", row => {
    cnt++;
    qstream.pause();
    // (cnt+1) % 100 == 0 && console.log(PGNM, row.tcode, cnt, row.uri);
    let ichk = setInterval(() => {
      const th = threads.find(t => t.busy == 0);
      if (th) {
        clearInterval(ichk);
        th.busy = 1;
        if (param.interval > 0) {
          setTimeout(() => {
            th.wkthread.postMessage(row.pkey);
          }, param.interval);
        } else {
          th.wkthread.postMessage(row.pkey);
        }
        qstream.resume();
      }
    }, 50);

  });

  qstream.on("end", () => {
    console.log(PGNM, param.tcode,"*Jobid:" + param?.jobId, "*** read ended ***");

    let ival = setInterval(async () => {
      for (const v of threads) { if (!v.busy) await v.wkthread.terminate() }
      // console.log(PGNM, "threads :", threads.length);
      if (threads.length == 0) {
        clearInterval(ival);
        if (param.loop > 0) {
          console.log(PGNM, "loop");
          new module.exports(param);
        } else {
          if (!dbskip)
            await con.query('call sp_summary(?)', [param.tcode]);

          if (param.hasOwnProperty('jobId'))
            await con.query("UPDATE texecjob set resultstat = 2, msg = concat(ifnull(msg,''),now(),': ',?,'\r\n' ), endDt = now() where pkey = ? ",
              [cnt + " 건 수행", param.jobId]);
          console.log(`${cnt} read, ${ucnt} update, ${ecnt} error`) ;
          param.exit && process.exit(0);
        }
      }
    }, 500);

  });


  

}

process.on('uncaughtException', (err) => { console.error(PGNM, err); process.exit(1) });