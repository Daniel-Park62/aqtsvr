/*
  { tcode, loop , cond, limit, dbskip, interval,jobId }
*/

"use strict";
const ktoa = require("./ktoainfo") ;
const MAX_RESP_LEN = 1024 * 32;
const PGNM = '[sendMain2]';
const moment = require('moment');
const cdate =  () => "tcp2Request " + moment().format("MM/DD HH:mm:ss.SSS :");

const { Worker, workerData } = require('worker_threads');

const aqttimeout = Number(process.env.AqtTimeOut) || 30000;
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
//  const threads = new Array();
  const thread_skt = new Array();
  const thread_ktf = new Array();
  const thread_lgt = new Array();
  const thread_kct = new Array();
  const thread_cjm = new Array();
  const thread_ons = new Array();
  
  dbskip = param.dbskip;
  param.saip = ktoa.SKT;
  thread_start(param, thread_skt);
  param.saip = ktoa.KTF;
  thread_start(param, thread_ktf);
  param.saip = ktoa.LGT;
  thread_start(param, thread_lgt);
  param.saip = ktoa.KCT;
  thread_start(param, thread_kct);
  param.saip = ktoa.CJM;
  thread_start(param, thread_cjm);
  param.saip = ktoa.ONS;
  thread_start(param, thread_ons);
  const qstr = "SELECT COUNT(*) cnt FROM ( select 1 from ttcppacket t where tcode = ? " + condi + vlimit + ") x";

  con.query(qstr, [param.tcode])
    .then(row => {
      tcnt = Number(row[0].cnt);
      console.log("%s Start 테스트id(%s) 작업수(%d) cond(%s) limit(%s) data건수(%d) pid(%d)"
        , PGNM, param.tcode, param.tnum, condi, vlimit, tcnt, process.pid);
    })
    .catch(err => console.log(PGNM, qstr, err));
  
  let sv_time ;
  let delay = 0;
  const qstream = con.queryStream("SELECT t.pkey,t.o_stime, t.srcip " +
    "FROM ttcppacket t join tmaster c on (t.tcode = c.code ) left join thostmap m on (t.tcode = m.tcode and t.appid = m.appid ) " +
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
    delay = param.interval ;
    if (param.exectype == '1' ) {
      if (sv_time) delay = (new Date(row.o_stime)) - (new Date(sv_time)) ;
      else delay = 0 ;
      sv_time = row.o_stime ;
    }
    let threads = thread_skt ;
    if (row.srcip == ktoa.SKT.srcip) threads = thread_skt ;
    else if (row.srcip == ktoa.KTF.srcip) threads = thread_ktf ;
    else if (row.srcip == ktoa.LGT.srcip) threads = thread_lgt ;
    else if (row.srcip == ktoa.KCT.srcip) threads = thread_kct ;
    else if (row.srcip == ktoa.CJM.srcip) threads = thread_cjm ;
    else if (row.srcip == ktoa.ONS.srcip) threads = thread_ons ;
    // (cnt+1) % 100 == 0 && console.log(PGNM, row.tcode, cnt, row.uri);
    let ichk = setInterval(() => {
      const th = threads.find(t => t.busy == 0);
      if (th) {
        clearInterval(ichk);
        th.busy = 1;
        if (delay > 0) {
          setTimeout(() => {
            th.wkthread.postMessage(row.pkey);
          }, delay );
        } else {
          th.wkthread.postMessage(row.pkey);
        }
        qstream.resume();
      }
    }, 10);

  });

  qstream.on("end", () => {
    console.log(PGNM, param.tcode,"*Jobid:" + param?.jobId, "*** read ended ***");
    thread_term(thread_skt) ;
    thread_term(thread_ktf) ;
    thread_term(thread_lgt) ;
    thread_term(thread_kct) ;
    thread_term(thread_cjm) ;
    thread_term(thread_ons) ;
    let ival = setInterval(async () => {
      console.log("check thread:", thread_skt.length + thread_ktf.length + thread_lgt.length +
          thread_kct.length + thread_cjm.length + thread_ons.length);
      if ((thread_skt.length + thread_ktf.length + thread_lgt.length +
           thread_kct.length + thread_cjm.length + thread_ons.length )  == 0 ) {
        clearInterval(ival);
        if (param.loop > 0) {
          console.log(PGNM, "loop");
          new module.exports(param);
        } else {
          console.log("** 작업종료처리 **")
          if (param.hasOwnProperty('jobId'))
            await con.query("UPDATE texecjob set resultstat = 9, msg = concat(ifnull(msg,''),now(),': ',?,'\r\n' ), endDt = now() where pkey = ? ",
          [cnt + " 건 수행", param.jobId]);
          console.log(cdate(), `${cnt} read, ${ucnt} update, ${ecnt} error`) ;
          if (!dbskip)
            await con.query('call sp_summary(?)', [param.tcode]);
          param.exit && process.exit(0);
        }
      }
    }, 100);

  });


  function thread_start(param, threads) {
    let TYPEF ;
    // if (process.env.AQTTYPE === 'TCP')
//  console.log(param);
    if (param.aqttype === 'TCP')
      TYPEF = '/tcp2Request.js';
    else  if (param.aqttype === 'UDP')
      TYPEF = '/udpRequest.js';
    else
      TYPEF = '/httpRequest.js';

    let msgs = " 총 " + tcnt + '건 송신 ' + (param.dbskip ? '(no Update)' : '') + (param.loop > 1 ? param.loop + " 회 반복" : '');
    const wdata = { workerData: { dbskip: param.dbskip, saup:param.saip , aqttimeout } };

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
            console.log(PGNM,(new Date()).toLocaleString(), 'thread all ended !!')
          }
        });
      wkthread.on('error', (err) => {
        console.log(PGNM, "Thread error ", err);
        if (param.hasOwnProperty('jobId'))
          con.query("UPDATE texecjob set resultstat = 3, msg = concat(msg, ?, now(),':', ?,'\r\n'), endDt = now() where pkey = ?", [msgs, err, param.jobId]);
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
	  
//		wkthread.postMessage({open:1}) ;
      // wkthread.postMessage(wdata) ;

    }
    console.log((new Date()).toLocaleString(), "threads:", threads.length, wdata.workerData);

  }

  function thread_term(threads) {
    if (threads.length == 0) return ;
    let ival = setInterval(async () => {
      for (const v of threads) { if (!v.busy) await v.wkthread.terminate() }
      // console.log(PGNM, "threads :", threads.length);
      if (threads.length == 0) {
        clearInterval(ival);
      }
    }, 50);

  }
}

process.on('uncaughtException', (err) => { console.error(PGNM, err); process.exit(1) });
