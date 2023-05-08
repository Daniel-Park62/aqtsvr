/*
  { tcode, loop , cond, limit, dbskip, interval,jobId }
*/

"use strict";

const MAX_RESP_LEN = 1024 * 32;
const PGNM = '[sendMain]';

const { Worker, workerData } = require('worker_threads');

const aqttimeout = process.env.AqtTimeOut || 30000;
console.log("AqtTimeOut:", aqttimeout, " (set AqtTimeOut=ms)");

let con = null;
let dbskip = false;

module.exports = function (param) {
  con = param.conn;
  if (!param.loop) param.loop = 1;
  param.loop--;
  let tcnt = 0;
  let cnt = 0;
  let ucnt = 0;
  let ecnt = 0;
  let condi = param.cond > ' ' ? "and (" + param.cond + ")" : "";
  let vlimit = param.limit > ' ' ? ' LIMIT ' + param.limit : "";
  let orderby = param.tcode.substr(0,1) === 'Z' ? ' order by rand() ' : ' order by o_stime ' ;
  const threads = new Array();
  
  dbskip = param.dbskip;
  thread_start(param);
  const qstr = "SELECT COUNT(*) cnt FROM ( select 1 from ttcppacket t where tcode = ? " + condi + vlimit + ") x";

  con.query(qstr, [param.tcode])
    .then(row => {
      tcnt = Number(row[0].cnt);
      console.log("%s Start 테스트id(%s) 작업수(%d) cond(%s) limit(%s) data건수(%d) pid(%d)"
        , PGNM, param.tcode, param.tnum, condi, vlimit, tcnt, process.pid);
    })
    .catch(err => console.log(PGNM, qstr, err));

  const qstream = con.queryStream("SELECT t.pkey,o_stime " +
    "FROM ttcppacket t join tmaster c on (t.tcode = c.code ) left join thostmap m on (t.tcode = m.tcode and t.dstip = m.thost and t.dstport = m.tport) " +
    "where t.tcode = ? " + condi + orderby + vlimit, [param.tcode]);

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


  function thread_start(param) {
    let TYPEF ;
    if (process.env.AQTTYPE === 'TCP')
      TYPEF = '/tcpRequest.js';
    else
      TYPEF = '/httpRequest.js';

    let msgs = " 총 " + tcnt + '건 송신 ' + (param.dbskip ? '(no Update)' : '') + (param.loop > 1 ? param.loop + " 회 반복" : '');
    const wdata = { workerData: { dbskip: param.dbskip, aqttimeout } };
    if (param.tnum < 1) param.tnum = 1;
    for (let i = 0; i < param.tnum; i++) {

      // const wdata =  [param.tcode, param.etc,  `${i},${pcnt}`  ];
      // console.log(PGNM, wdata) ;
      // msgs  += ':'+vlimit;
      const wkthread = new Worker(__dirname + TYPEF, wdata)
        .on('exit', () => {
          const i = threads.findIndex(w => w.wkthread == wkthread);
          if (i !== -1) threads.splice(i, 1);

          // console.log(PGNM, i, `Thread exiting, ${threads.length} running...`);
          if (threads.length == 0) {
            console.log(PGNM, 'thread all ended !!')
          }
        });
      wkthread.on('error', (err) => {
        console.log(PGNM, "Thread error ", err);
        if (param.hasOwnProperty('jobId'))
          con.query("UPDATE texecjob set resultstat = 3, msg = concat(msg, ?, now(),':', ?,'\r\n'), endDt = now() where pkey = ?", [msgs, err, param.joId]);
      });
      wkthread.on('message', (dat) => {
        // console.log(PGNM, "Thread data ", dat);
        if (dat?.svCook) {
          threads.forEach(t => t.wkthread.postMessage(dat));
          return;
        }
        dat?.ok && ucnt++;
        dat?.err && ecnt++;
        for (const w of threads) { if (w.wkthread == wkthread) {w.busy = 0; break;} }
        
      });

      threads.push({ id: wkthread.threadId, wkthread });

      // wkthread.postMessage(wdata) ;

    }
    console.log("threads:", threads.length, wdata.workerData);

  }

}

process.on('uncaughtException', (err) => { console.error(PGNM, err); process.exit(1) });