"use strict";
const { fork } = require('child_process');
logger = require('./lib/logs/aqtLogger').child({label:'execJob'});
if (process.argv.length < 3 ) {
    logger.info(" Job Id 를 지정하세요.");
    process.exit(1);
}
const jobid = process.argv[2] ;
let childid ;
(async () => {
  const con = await require('./db/db_con1');
  logger.info( "* start Execute Job");
  
  try {
    const rows = await con.query("select pkey, jobkind, tcode, tnum,dbskip, exectype,etc,in_file, \
                reqnum, repnum, limits, ifnull(msg,'') msg from texecjob \
              WHERE pkey = ? AND resultstat = 2 ",[jobid] ) ;
      if (rows.length == 0) return;
      
      await con.query("INSERT INTO texecing (pkey) values (?) on duplicate key update tcnt=1,ccnt=0,ecnt=0 ; ", [rows[0].pkey]) ;

      if (rows[0].jobkind != 9)
        dumpData(rows[0]);
      else {
        await sendData(rows[0]);
      }

  } catch (err) {
    logger.error( JSON.stringify(err) ) ;
  }
 

  async function dumpData(row) {
    childid = fork('./aqt_dumpToDb',[row.pkey, JSON.stringify(row)] );
    childid.on('error',(err) => logger.error(`fork error: ${err.message}`) ) ;
  }

  async function sendData(row) {

    con.query("SELECT lvl,if(pro='1','HTTP',IF(pro='2','UDP','TCP')) pro FROM TMASTER WHERE CODE = ?", [row.tcode])
      .then( dat => {
        if (dat[0].lvl == '0') {
          logger.info( "Origin ID 는 테스트 불가합니다.");
          con.query("UPDATE texecjob set resultstat = 3, msg = concat(msg,now(),':Origin ID 는 테스트 불가합니다.\r\n', endDt = now() where pkey = ?", [row.pkey]);
          return;
        }

        childid = fork('./lib/sendMain3');
        logger.info( "child pid=> ", childid.pid);
        childid.on('exit',()=>{logger.info("child end:",childid.pid)}) ;

        let param = {
          tcode: row.tcode, cond: row.etc, tnum: row.tnum, aqttype: dat[0].pro, exectype: row.exectype
          , limit: row.limits, interval: row.reqnum, loop: row.repnum, dbskip: row.dbskip == '1', jobId: row.pkey
        };
        childid.send(param) ;
      })
      .catch(err => {
        logger.info( err);
        con.query("UPDATE texecjob set resultstat = 3, msg = concat(?,now(),':',?,'\r\n' ), endDt = now() where pkey = ?", [row.msg, err, row.pkey]);
      });
  }
  function endprog() {
    logger.info( "## Exec job program End");
    if (con) con.end();
    if (childid) childid.kill() ;
    process.exit(0)
  }

  process.on('SIGINT', endprog);
  // process.on('SIGKILL',() => { console.log('KILL'); endprog; process.exit(0) } ); 
  process.on('SIGTERM', endprog);
  process.on('uncaughtException', (err) => { logger.info( 'uncaughtException:', err); });
  })() ;
