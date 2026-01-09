/*
  { tcode, loop , cond, limit, dbskip, interval,jobId }
*/

"use strict";

const cdate = () => "[sendMain3] " + (new Date()).toLocaleString('lt').substring(5);

const { fork } = require('child_process');

let con = null;
let cnt = 0;
let startt;
const childs = new Array();

module.exports = function () {
  function nsleep(ms) {
    const endt = process.hrtime.bigint() + BigInt(ms * 1_000_000);
    while (process.hrtime.bigint() < endt) { };
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function child_send(sdata) {
    while (childs.length > 0) {
      const ix = childs.findIndex(t => t.busy == 0);
      if (ix > -1) {
        const th = childs.splice(ix, 1)[0];

        if (th) {
          childs.push(th);
          th.busy = 1;
          th.wkthread.send(sdata);
          break;
        }
      }
      await sleep(0);
    }

    function childs_start(param) {
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

        const wkthread = fork(__dirname + TYPEF, [JSON.stringify(wdata)])
          .on('exit', () => {
            const i = childs.findIndex(w => w.wkthread == wkthread);
            if (i !== -1) childs.splice(i, 1);

            // console.log(PGNM, i, `Thread exiting, ${childs.length} running...`);
            if (childs.length == 0) {
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
            childs.forEach(t => t.wkthread.send(dat));
            return;
          }
          dat?.ok && ucnt++;
          dat?.err && ecnt++;
          for (const w of childs) { if (w.wkthread == wkthread) { w.busy = 0; break; } }
          const elapsed = (performance.now() - startt) / 1000;
          if (param.hasOwnProperty('jobId') && sv_cnt !== cnt) {
            con.query("update texecing set ccnt = ?, ecnt= ?,elaps=? where pkey = ?", [cnt, ecnt, elapsed, param.jobId]);
            sv_cnt = cnt;
          }
        });

        childs.push({ id: wkthread.threadId, wkthread });

      }
      console.log(cdate(), "childs:", childs.length, wdata);

    }

    function childs_end() {
      const ival = setInterval(async () => {
        for (const v of childs) { if (!v.busy) await v.wkthread.kill() }
        // console.log(PGNM, "childs :", childs.length);
        if (childs.length == 0) {
          clearInterval(ival);
          if (param.loop > 0) {
            console.log(cdate(), "# Number of iterations remaining :", param.loop);
          } else {
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
        }
      }, 500);

    }
  }
}
