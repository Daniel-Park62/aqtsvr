/*
  { tcode, loop , cond, limit, dbskip, interval,jobId }
*/

"use strict";
const moment = require('moment');
const cdate = () => "[sendMain] " + moment().format("MM/DD HH:mm:ss.SSS :");

const MAX_RESP_LEN = 1024 * 32;

const { Worker, workerData } = require('worker_threads');

const aqttimeout = Number(process.env.AqtTimeOut) || 30000;
console.log("AqtTimeOut:", aqttimeout, " (set AqtTimeOut=ms)");

let con = null;
let dbskip = false;

module.exports = async function (param) {
  con = param.conn;
  if (!param.loop) param.loop = 1;
  param.loop--;
  let tcnt = 0;
  let cnt = 0;
  let ucnt = 0;
  let ecnt = 0;
  let condi = param.cond > ' ' ? "and (" + param.cond + ")" : "";
  let vlimit = param.limit > ' ' ? ' LIMIT ' + param.limit : "";
  let orderby = param.tcode.substr(0, 1) === 'Z' ? ' order by rand() ' : ' order by o_stime ';
  const threads = new Array();

  dbskip = param.dbskip;
  thread_start(param);
  const qstr = "SELECT COUNT(*) cnt FROM ( select 1 from ttcppacket t where tcode = ? " + condi + vlimit + ") x";

  con.query(qstr, [param.tcode])
    .then(row => {
      tcnt = Number(row[0].cnt);
      console.log("%s Start 테스트id(%s) 작업수(%d) cond(%s) limit(%s) data건수(%d) pid(%d)"
        , cdate(), param.tcode, param.tnum, condi, vlimit, tcnt, process.pid);
    })
    .catch(err => console.log(cdate(), qstr, err));

  let sv_time;
  let delay = 0;

  for await (const row of con.queryStream("SELECT t.pkey,o_stime " +
    "FROM ttcppacket t join tmaster c on (t.tcode = c.code ) left join thostmap m on (t.tcode = m.tcode and t.dstip = m.thost and t.dstport = m.tport) " +
    "where t.tcode = ? " + condi + orderby + vlimit, [param.tcode])) {
    cnt++;
    delay = param.interval;
    if (param.exectype == '1') {
      if (sv_time) delay = (new Date(row.o_stime)) - (new Date(sv_time));
      else delay = 50;
      sv_time = row.o_stime;
      if (delay < 10) delay = 50;
    }

    while(threads.length > 0) {
      const th = threads.find(t => t.busy == 0);
      // console.log(cdate(),'loop',th, cnt) ;
      if (th) {
        th.busy = 1;
        if (delay > 0)  await sleep(delay);
        th.wkthread.postMessage(row.pkey);
        break ;
      }
      await sleep(50);
      if (delay > 50)  delay -= 50 ; else delay = 0;
    };

    if (threads.length == 0) break ;

  };
  console.log(cdate(), param.tcode, "Count:", cnt, "*Jobid:" + param?.jobId, "*** read ended ***");

  let ival = setInterval(async () => {
    for (const v of threads) { if (!v.busy) await v.wkthread.terminate() }
    // console.log(PGNM, "threads :", threads.length);
    if (threads.length == 0) {
      clearInterval(ival);
      if (param.loop > 0) {
        console.log(cdate(), "# Number of iterations remaining :",param.loop );
        module.exports(param);
      } else {
        if (!dbskip)
          await con.query('call sp_summary(?)', [param.tcode]);

        if (param.hasOwnProperty('jobId'))
          await con.query("UPDATE texecjob set resultstat = 2, msg = concat(ifnull(msg,''),now(),': ',?,'\r\n' ), endDt = now() where pkey = ? ",
            [cnt + " 건 수행", param.jobId]);
        console.log(cdate(),`${cnt} read, ${ucnt} update, ${ecnt} error`);
        param.exit && process.exit(0);
      }
    }
  }, 500);

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  function thread_start(param) {
    let TYPEF;
    // if (process.env.AQTTYPE === 'TCP')
    if (param.aqttype === 'TCP')
      TYPEF = '/tcpRequest.js';
    else if (param.aqttype === 'UDP')
      TYPEF = '/udpRequest.js';
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
            console.log(cdate(), 'thread all ended !!')
          }
        });
      wkthread.on('error', (err) => {
        console.log(cdate(), "Thread error ", err);
        if (param.hasOwnProperty('jobId'))
          con.query("UPDATE texecjob set resultstat = 3, msg = concat(msg, ?, now(),':', ?,?,'\r\n'), endDt = now() where pkey = ?", [msgs, err,cnt, param.jobId]);
      });
      wkthread.on('message', (dat) => {
        // console.log(PGNM, "Thread data ", dat);
        if (dat?.svCook) {
          threads.forEach(t => t.wkthread.postMessage(dat));
          return;
        }
        dat?.ok && ucnt++;
        dat?.err && ecnt++;
        for (const w of threads) { if (w.wkthread == wkthread) { w.busy = 0; break; } }

      });

      threads.push({ id: wkthread.threadId, wkthread });

      // wkthread.postMessage(wdata) ;

    }
    console.log(cdate(), "threads:", threads.length, wdata.workerData);

  }

}

process.on('uncaughtException', (err) => { console.error(cdate(), err) });