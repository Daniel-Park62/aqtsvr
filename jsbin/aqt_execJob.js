"use strict";
const { fork } = require('child_process');
logger = require('./lib/logs/aqtLogger').child({label:'execJob'});
(async () => {
  let jcnt = 0 ;
  const con = await require('./db/db_con1');
  try {
    logger.info( "* start Execute Job");
    await con.query("UPDATE texecjob set resultstat = 3, endDt = now() where resultstat = 1; update texecing set reqkill='' where reqkill='1'; ") ;
  } catch (err) {
    logger.error( `UPDATE texecjob error-1: ${err.message}`) ;
  }

  setInterval(async () => {
    try {
      con.query("select pkey, pidv from texecing where pidv > 0 and reqkill = '1' ")  
      .then(row => {
        if (row.length>0 ){
          con.query("update texecing set reqkill='k' where pkey=?",[row[0].pkey]) ;
          logger.info(`* kill : ${row[0].pidv}`);
          process.kill(row[0].pidv);
        }
      });
      const rows = await con.query("select pkey, jobkind, tcode, tnum,dbskip, exectype,etc,in_file, \
                  reqnum, repnum, limits, ifnull(msg,'') msg from texecjob \
                WHERE reqstartdt <= NOW() and resultstat=0 and jobkind in (2,9) and ppkey = 0 \
                  AND TCODE in (select code from tmaster where pro != '3' and lvl != '0') order by reqstartdt LIMIT 1" ) ;
        jcnt++ ;
//        if (jcnt % 100 == 0) logger.info( "exec checking..", jcnt) ;
        if (rows.length == 0) return;
        
        await con.query("INSERT INTO texecing (pkey) values (?) on duplicate key update tcnt=1,ccnt=0,ecnt=0 ; ", [rows[0].pkey]) ;
        await con.query("UPDATE texecjob set resultstat = 1, startDt = now(), endDt = null where pkey = ?", [rows[0].pkey]);

        if (rows[0].jobkind == 2)
          dumpData(rows[0]);
        else {
          await sendData(rows[0]);
        }

    } catch (err) {
      logger.error( JSON.stringify(err) ) ;
    }

  }, 2 * 1000);

  async function dumpData(row) {
    const dumpData = fork('./aqt_dumpToDb',[row.pkey, JSON.stringify(row)] );
    dumpData.on('error',(err) => logger.error(`fork error: ${err.message}`) ;
    
  }
  async function sendData(row) {

    return con.query("SELECT lvl,if(pro='1','HTTP',IF(pro='2','UDP','TCP')) pro FROM TMASTER WHERE CODE = ?", [row.tcode])
      .then( dat => {
        if (dat[0].lvl == '0') {
          logger.info( "Origin ID 는 테스트 불가합니다.");
          con.query("UPDATE texecjob set resultstat = 3, msg = concat(msg,now(),':Origin ID 는 테스트 불가합니다.\r\n', endDt = now() where pkey = ?", [row.pkey]);
          return;
        }
//        const sendMain = require('./lib/sendMain');
        const sendMain = fork('./lib/sendMain3');
        logger.info( "child pid=> ", sendMain.pid);
        sendMain.on('exit',()=>{logger.info("child end:",sendMain.pid)}) ;

        let param = {
          tcode: row.tcode, cond: row.etc, tnum: row.tnum, aqttype: dat[0].pro, exectype: row.exectype
          , limit: row.limits, interval: row.reqnum, loop: row.repnum, dbskip: row.dbskip == '1', jobId: row.pkey
        };
        sendMain.send(param) ;
      })
      .catch(err => {
        logger.info( err);
        con.query("UPDATE texecjob set resultstat = 3, msg = concat(?,now(),':',?,'\r\n' ), endDt = now() where pkey = ?", [row.msg, err, row.pkey]);
      });
  }
  function endprog() {
    logger.info( "## Exec job program End");
    if (con) con.end();
    process.exit(0)
  }

  process.on('SIGINT', endprog);
  // process.on('SIGKILL',() => { console.log('KILL'); endprog; process.exit(0) } ); 
  process.on('SIGTERM', endprog);
  process.on('uncaughtException', (err) => { logger.info( 'uncaughtException:', err); });
  })() ;
