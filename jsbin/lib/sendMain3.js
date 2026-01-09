/*
  { tcode, loop , cond, limit, dbskip, interval,jobId }
*/

"use strict";

const cdate = () => "[sendMain3] " + (new Date()).toLocaleString('lt').substring(5);

const MAX_RESP_LEN = 1024 * 32;

const { fork } = require('child_process');

const aqttimeout = Number(process.env.AqtTimeOut) || 30000;
console.log(cdate(), "AqtTimeOut:", aqttimeout);

let con = null;
let conR = null;
let dbskip = false;
let cnt = 0;
let startt;
const threads = new Array();

process.on('SIGTERM', () => {
  con.end(); conR.end();
  console.log(cdate(), "stop process");
  process.exit(0);
});

process.on('message', (param) => {
  main(param);
});

async function main(param) {
  con = await require('../db/db_con1'); // param.conn;
  conR = await require('../db/db_con1'); // param.conn;
  if (!param.loop) param.loop = 1;
  let tcnt = 0;

  let condi = param.cond > ' ' ? "and (" + param.cond + ")" : "";
  let vlimit = param.limit > ' ' ? ' LIMIT ' + param.limit : "";
  let orderby = param.tcode.substr(0, 1) === 'Z' ? ' order by rand() ' : ' order by o_stime ';

  dbskip = param.dbskip;
  thread_start(param);
  while (param.loop-- > 0) {
    let sv_time;
    let delay = 0;
    const rows = await conR.query("SELECT t.pkey,o_stime FROM ttcppacket t  " +
      "where t.tcode = ? " + condi + orderby + vlimit, [param.tcode]);
    tcnt = rows.length;
    if (param.hasOwnProperty('jobId')) {
      con.query(" update texecing set tcnt = ?, ccnt = 0, ecnt= 0, pidv = ?,elaps=0 where pkey = ? ", [tcnt, process.pid, param.jobId]);
    }
    console.log("%s Start 테스트id(%s) 작업수(%d) cond(%s) limit(%s) data건수(%d) pid(%d)"
      , cdate(), param.tcode, param.tnum, condi, vlimit, tcnt, process.pid);

    startt = performance.now();
    for await (const row of rows) {
      cnt++;
      delay = param.interval;
      if (param.exectype == '1') {
        if (sv_time) delay = (new Date(row.o_stime)) - (new Date(sv_time));
        else delay = 0;
        sv_time = row.o_stime;
        if (delay > param.interval) delay = param.interval;
      }

      if (delay) nsleep(delay);
      // console.log("delay2:",delay) ;

      while (threads.length > 0) {
        const ix = threads.findIndex(t => t.busy == 0);
        if (ix > -1) {
          const th = threads.splice(ix, 1)[0];
          // console.log(cdate(),'loop',th, cnt) ;
          if (th) {
            threads.push(th);
            th.busy = 1;
            th.wkthread.send(row.pkey);
            break;
          }
        }
        await sleep(0);
        // if (delay > 50)  delay -= 50 ; else delay = 0;
      };

      if (threads.length == 0) break;

    };
  }
  console.log(cdate(), param.tcode, "Count:", cnt, "*Jobid:" + param?.jobId, "*** read ended ***");

  const ival = setInterval(async () => {
    for (const v of threads) { if (!v.busy) await v.wkthread.kill() }
    // console.log(PGNM, "threads :", threads.length);
    if (threads.length == 0) {
      clearInterval(ival);
      if (param.hasOwnProperty('jobId'))
        await con.query("UPDATE texecjob x,texecing y set resultstat = 2, x.tcnt= y.tcnt,x.ccnt=y.ccnt,x.ecnt=y.ccnt," +
          "msg = concat(msg,now(),':',y.ccnt,'건 수행\r\n' ), endDt = now() where x.pkey = ? and x.pkey = y.pkey",
          [param.jobId]);
      if (!dbskip)
        await con.query('call sp_summary(?)', [param.tcode]);
      con.end();
      conR.end();
      console.log(cdate(), `${cnt} read`);
      process.exit(0);
    }
  }, 500);

}

function nsleep(ms) {
  const endt = process.hrtime.bigint() + BigInt(ms * 1_000_000);
  while (process.hrtime.bigint() < endt) { };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function thread_start(param) {
  let ucnt = 0, ecnt = 0, sv_cnt = 0;

  let TYPEF;
  // if (process.env.AQTTYPE === 'TCP')
  if (param.aqttype === 'TCP')
    TYPEF = '/tcpRequest3.js';
  else if (param.aqttype === 'UDP')
    TYPEF = '/udpRequest3.js';
  else
    TYPEF = '/httpRequest3.js';

  const wdata = { dbskip: param.dbskip, aqttimeout };
  if (param.tnum < 1) param.tnum = 1;
  for (let i = 0; i < param.tnum; i++) {

    // const wdata =  [param.tcode, param.etc,  `${i},${pcnt}`  ];
    // console.log(PGNM, wdata) ;
    // msgs  += ':'+vlimit;
    const wkthread = fork(__dirname + TYPEF, [JSON.stringify(wdata)])
      .on('exit', () => {
        const i = threads.findIndex(w => w.wkthread == wkthread);
        if (i !== -1) threads.splice(i, 1);

        // console.log(PGNM, i, `Thread exiting, ${threads.length} running...`);
        if (threads.length == 0) {
          console.log(cdate(), 'child all ended !!')
        }
      });
    wkthread.on('error', async (err) => {
      console.log(cdate(), "child error ", err);
      if (param.hasOwnProperty('jobId'))
        await con.query("UPDATE texecjob x,texecing y set resultstat = 3, x.tcnt= y.tcnt,x.ccnt=y.ccnt,x.ecnt=y.ccnt," +
          "msg = concat(msg,now(),':',y.ccnt,'건 수행\r\n' ), endDt = now() where x.pkey = ? and x.pkey = y.pkey",
          [param.jobId]);
    });
    wkthread.on('message', (dat) => {
      // console.log(PGNM, "Thread data ", dat);
      if (dat?.svCook) {
        threads.forEach(t => t.wkthread.send(dat));
        return;
      }
      dat?.ok && ucnt++;
      dat?.err && ecnt++;
      for (const w of threads) { if (w.wkthread == wkthread) { w.busy = 0; break; } }
      const elapsed = (performance.now() - startt) / 1000;
      if (param.hasOwnProperty('jobId') && sv_cnt !== cnt) {
        con.query("update texecing set ccnt = ?, ecnt= ?,elaps=? where pkey = ?", [cnt, ecnt, elapsed, param.jobId]);
        sv_cnt = cnt;
      }
    });

    threads.push({ id: wkthread.threadId, wkthread });

    // wkthread.postMessage(wdata) ;

  }
  console.log(cdate(), "threads:", threads.length, wdata);

}

process.on('uncaughtException', (err) => { console.error(cdate(), err) });