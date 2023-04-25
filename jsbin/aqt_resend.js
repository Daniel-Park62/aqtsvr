"use strict";
const PGNM = '[Resend]';
const MAX_RESP_LEN = 1024 * 32;
const Dsec = /^\d+$/.test(process.argv[2]) ? process.argv[2] * 1 : 5;
let con;
let cnt=0;
const { Worker, workerData } = require('worker_threads');
const threads = new Array();

async function main() {
  thread_start();
  con = await require('./db/db_con1') ;
  console.log("%s * start Resend check (%d 초 단위)", PGNM, Dsec);
  // const sendhttp = require('./lib/sendHttp') ;
  setInterval(() => {

    const qstream = con.queryStream("SELECT pkey FROM trequest order by reqDt  ");
    qstream.on("error", err => {
      console.log(PGNM, err); //if error
    });
    qstream.on("fields", meta => {
      // console.log(meta); // [ ...]
    });
    qstream.on("data", async row => {
      qstream.pause();

      let ichk = setInterval(() => {
        const th = threads.find(t => t.busy == 0);
        if (th) {
          clearInterval(ichk);
          th.busy = 1;
          th.wkthread.postMessage(row.pkey);
          qstream.resume();
          con.query("DELETE FROM trequest where pkey = ?", [row.pkey]) ;
        } 
      }, 50);
  
    });
    // qstream.on("end", () => {
    //     console.log(PGNM,"read ended");
    // });
  }, Dsec * 1000);

}

function thread_start() {
  const aqttimeout = process.env.aqtHttpTimeOut || 5000;
  const wdata = { workerData: { dbskip: false, aqttimeout } };
  
  for (let i = 0; i < 5; i++) {

    // const wdata =  [param.tcode, param.etc,  `${i},${pcnt}`  ];
    // console.log(PGNM, wdata) ;
    // msgs  += ':'+vlimit;
    const wkthread = new Worker(__dirname + '/lib/httpRequest.js', wdata)
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
    });
    wkthread.on('message', (dat) => {
      // console.log(PGNM, "Thread data ", dat,cnt);
      dat?.ok && cnt++;
      if (dat?.svCook) {
        threads.forEach( t => t.wkthread.postMessage(dat)) ;
        return ;
      }
      for (const w of  threads) { if ( w.wkthread == wkthread ) w.busy = 0;}
      
    });

    threads.push({ id: wkthread.threadId, wkthread });

    // wkthread.postMessage(wdata) ;

  }
  console.log("threads:", threads.length, wdata.workerData);

}

function endprog() {
  console.log(PGNM, "program End", cnt,"건 수행");
  // child.kill('SIGINT') ;
  con.end();
  process.exit(0) ;
}

process.on('SIGINT', endprog);
process.on('SIGTERM', endprog);
process.on('uncaughtException', (err) => { console.log('uncaughtException:', err); process.exit(0) });
// process.on('exit', endprog);
main() ;