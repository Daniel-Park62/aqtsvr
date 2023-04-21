"use strict";

const { Worker, isMainThread, workerData } = require('worker_threads');
const args = require('./cap_info');
const PGNM = '[aqtExecJob]';

const moment = require('moment');
const con = require('./db/db_con'); 

const http = require('http');
const { resolve } = require('path');
const { rejects } = require('assert');
moment.prototype.toSqlfmt = function () {
  return this.format('YYYY-MM-DD HH:mm:ss.SSSSSS');
};

// const net = require("net");
// const client = new net.Socket();


console.log(PGNM, "* start Execute Job");

setInterval(() => {
  con.query("select pkey, jobkind, tcode, tnum,dbskip, exectype,etc,in_file, \
                  reqnum, repnum, ifnull(msg,'') msg from texecjob \
                WHERE reqstartdt <= NOW() and resultstat=0 and jobkind in (1,9) order by reqstartdt LIMIT 1" )
    .then(rows => {
      if (rows.length == 0) return;

      con.query("UPDATE texecjob set resultstat = 1, startDt = now(), endDt = null where pkey = ?", [rows[0].pkey])
        .catch(err => console.error(err));


      if (rows[0].jobkind == 1)
        importData(rows[0]);
      // else if (rows[0].tnum >= 1)
      //   sendWorker(rows[0]);
      else
        sendData(rows[0]);

    })
    .catch(err => {
      console.log(PGNM, err);
      return;
    });

}, 2 * 1000);


async function importData(row) {
  const cdb = require('./lib/capToDb');
  args.tcode = row.tcode;
  args.dstv = row.in_file;
  args.ptype = 'F';
  args.jobId = row.pkey;
  args.conn = await con.getConnection();
  new cdb(args);
}

function sendData(row) {
  con.query("SELECT lvl FROM TMASTER WHERE CODE = ?", [row.tcode])
    .then(async dat => {
      if (dat[0].lvl == '0') {
        console.log(PGNM, "Origin ID 는 테스트 불가합니다.");
        con.query("UPDATE texecjob set resultstat = 3, msg = 'Origin ID 는 테스트 불가합니다.', endDt = now() where pkey = ?", [row.pkey]);
        return;
      }
      const sendhttp = require('./lib/sendHttp2');
      console.log(PGNM, "pid=>", process.pid);
      let qstr = "UPDATE texecjob set resultstat = 2, msg = concat(?,now(),':',?,'\r\n' ), endDt = now() where pkey = " + row.pkey;
      let param = {
        tcode: row.tcode, cond: row.etc, conn: await con.getConnection(), tnum:row.tnum
        , limit: '', interval: row.reqnum, loop: row.repnum , dbskip: row.dbskip == '1', jobId: row.pkey
      };
      new sendhttp(param);
    })
    .catch(err => {
      console.log(PGNM, err);
      con.query("UPDATE texecjob set resultstat = 3, msg = concat(?,now(),':',?,'\r\n' ), endDt = now() where pkey = ?", [row.msg, err, row.pkey]);
    });
}

function sendWorker(row) {
  let condi = row.etc > ' ' ? "and (" + row.etc + ")" : "";
  const qstr = "SELECT COUNT(*) cnt FROM ttcppacket t where tcode = ? " + condi;
  const threads = new Set();
  let tcnt = 0, pcnt = 0;
  con.query(qstr, [row.tcode],
    (err, d) => {
      if (!err) {
        tcnt = d[0].cnt;

        if (tcnt == 0) {
          console.log(PGNM, qstr, "처리할 데이터가 없습니다.");
          con.query("UPDATE texecjob set resultstat = 2, msg = concat(msg, ?, now(),':', '처리건수 0\r\n' ), \
                  endDt = now() where pkey = ?", ["처리할 데이터가 없습니다.", row.pkey]);
          return;
        }
        pcnt = Math.ceil(tcnt / row.tnum);
        thread_start();

      } else {
        console.log(PGNM, err);
        con.query("UPDATE texecjob set resultstat = 3, msg = concat(msg,now(),':', ?,'\r\n'), endDt = now() where pkey = ?", [err, row.pkey]);
      }
    }
  );

  function thread_start() {
    console.log(PGNM + "thread start ", tcnt, pcnt);
    let msgs = " 총 " + tcnt + '건 송신 ' + (row.dbskip == '1' ? '(no Update)' : '') + (row.repnum > 1 ? row.repnum + " 회 반복" : '');
    for (let i = 0; i < tcnt; i += pcnt) {
      let i2 = pcnt;
      if (tcnt < i + pcnt) i2 = (tcnt - i);
      let vlimit = row.dbskip == '1' || row.tnum == 1 ? "" : i + "," + i2;
      const wdata = { workerData: { tcode: row.tcode, cond: row.etc, dbskip: row.dbskip == '1', interval: row.reqnum, limit: vlimit, loop: row.repnum } };
      // const wdata =  [row.tcode, row.etc,  `${i},${pcnt}`  ];
      // console.log(PGNM, wdata) ;
      // msgs  += ':'+vlimit;
      const wkthread = new Worker(__dirname + '/aqt_sendWorker.js', wdata)
        .on('exit', () => {
          threads.delete(wkthread);

          console.log(PGNM, `Thread exiting, ${threads.size} running...`);
          if (threads.size == 0) {
            console.log(PGNM, 'thread all ended !!')
            const qstr = "UPDATE texecjob set resultstat = 2, msg = concat(?, now(),':',?,'\r\n' ), endDt = now() where pkey = " + row.pkey;
            con.query(qstr, [row.msg, msgs]);
          }
        });
      wkthread.on('error', (err) => {
        console.log(PGNM, "Thread error ", err);
        con.query("UPDATE texecjob set resultstat = 3, msg = concat(?, now(),':', ?,'\r\n'), endDt = now() where pkey = ?", [row.msg, err, row.pkey]);
      });
      threads.add(wkthread);
      // wkthread.postMessage(wdata) ;

    }
  };

}

function endprog() {
  console.log(PGNM, "## Exec job program End");
  con.end();
}

function myquery(sql, args) {
  return new Promise((resolve, rejects) => {
    con.query(sql, args, (err, rows) => {
      if (err) return rejects(err);
      resolve(row);
    })
  });
}

process.on('SIGINT', () => { endprog; process.exit(0) });
// process.on('SIGKILL',() => { console.log('KILL'); endprog; process.exit(0) } ); 

process.on('SIGTERM', endprog);
process.on('uncaughtException', (err) => { console.log(PGNM, 'uncaughtException:', err); process.exit(1) });
process.on('exit', endprog);
