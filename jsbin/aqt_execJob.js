"use strict";
const { fork } = require('child_process');
const args = {
  aqttype: '',
  tcode: null,
  dstip: '192.168.196.129',
  dstport: '8888',
  svcid: '',
  ptype: 'F',
  dstf: null,
  otherCond: '',
  norcv: null,
  dbskip:'N',
  maxcnt: 0,
  conn: null,
  jobId: 0
};

const logfnm = (new Date()).toLocaleString('lt').replace(/[ :-]/g,'').substring(0,12) ;
const cdate = () => "[aqtExecJob] " + (new Date()).toLocaleString('lt').substring(5) ;
// console.log(cdate(),"Logfile:",logfnm+ ".log");
// require('./lib/logfilec')(logfnm + ".log");
//logf(logfnm + ".log");
(async () => {
  let jcnt = 0 ;
  const con = await require('./db/db_con1');
  // console.log("con:",con) ;
  try {
    console.log(cdate(), "* start Execute Job");
    await con.query("UPDATE texecjob set resultstat = 3, endDt = now() where resultstat = 1; update texecing set reqkill='' where reqkill='1'; ") ;
  } catch (err) {
    console.error(cdate(), err) ;
  }

  setInterval(async () => {
    try {
      con.query("select pkey, pidv from texecing where pidv > 0 and reqkill = '1' ")  
      .then(row => {
        if (row.length>0 ){
          con.query("update texecing set reqkill='k' where pkey=?",[row[0].pkey]) ;
          console.log(cdate(),"* kill ", row[0].pidv);
          process.kill(row[0].pidv);
        }
      });
      const rows = await con.query("select pkey, jobkind, tcode, tnum,dbskip, exectype,etc,in_file, \
                  reqnum, repnum, limits, ifnull(msg,'') msg from texecjob \
                WHERE reqstartdt <= NOW() and resultstat=0 and jobkind in (1,9) and ppkey = 0 \
                  AND TCODE in (select code from tmaster where pro != '3' and lvl != '0') order by reqstartdt LIMIT 1" ) ;
        jcnt++ ;
//        if (jcnt % 100 == 0) console.log(cdate(), "exec checking..", jcnt) ;
        if (rows.length == 0) return;
        
        await con.query("INSERT INTO texecing (pkey) values (?) on duplicate key update tcnt=1,ccnt=0,ecnt=0 ; ", [rows[0].pkey]) ;
        await con.query("UPDATE texecjob set resultstat = 1, startDt = now(), endDt = null where pkey = ?", [rows[0].pkey]);

        if (rows[0].jobkind == 1)
          importData(rows[0]);
        else {
          await sendData(rows[0]);
        }

    } catch (err) {
      console.error(cdate(), err) ;
    }

  }, 2 * 1000);

  async function importData(row) {
    const cdb = require('./lib/capToDb');
    args.tcode = row.tcode;
    args.dstf = row.in_file;
    args.ptype = 'F';
    args.jobId = row.pkey;
    // args.conn =  await con.getConnection();
    new cdb(args);
  }
  async function sendData(row) {

    return con.query("SELECT lvl,if(pro='1','HTTP',IF(pro='2','UDP','TCP')) pro FROM TMASTER WHERE CODE = ?", [row.tcode])
      .then( dat => {
        if (dat[0].lvl == '0') {
          console.log(cdate(), "Origin ID 는 테스트 불가합니다.");
          con.query("UPDATE texecjob set resultstat = 3, msg = concat(msg,now(),':Origin ID 는 테스트 불가합니다.\r\n', endDt = now() where pkey = ?", [row.pkey]);
          return;
        }
//        const sendMain = require('./lib/sendMain');
        const sendMain = fork('./lib/sendMain3');
        console.log(cdate(), "child pid=> ", sendMain.pid);
        sendMain.on('exit',()=>{console.log(cdate(),"child end:",sendMain.pid)}) ;

        let param = {
          tcode: row.tcode, cond: row.etc, tnum: row.tnum, aqttype: dat[0].pro, exectype: row.exectype
          , limit: row.limits, interval: row.reqnum, loop: row.repnum, dbskip: row.dbskip == '1', jobId: row.pkey
        };
//        sendMain(param);
        sendMain.send(param) ;
      })
      .catch(err => {
        console.log(cdate(), err);
        con.query("UPDATE texecjob set resultstat = 3, msg = concat(?,now(),':',?,'\r\n' ), endDt = now() where pkey = ?", [row.msg, err, row.pkey]);
      });
  }
  function endprog() {
    console.log(cdate(), "## Exec job program End");
    if (con) con.end();
    process.exit(0)
  }

  process.on('SIGINT', endprog);
  // process.on('SIGKILL',() => { console.log('KILL'); endprog; process.exit(0) } ); 
  process.on('SIGTERM', endprog);
  process.on('uncaughtException', (err) => { console.log(cdate(), 'uncaughtException:', err); });
  })() ;
