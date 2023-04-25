"use strict";
/*
  테스트id 조건 limit 
*/
const MAX_RESP_LEN = 1024 * 32;
const v_tcode = process.argv[2] ;
if (undefined == v_tcode ) {
  console.info("테스트ID를 지정하세요.") ;
  process.exit(1) ;
}

require('./db/db_con1').then(  conn => {
  let param = { tcode : v_tcode, cond: (process.argv[3] ?  process.argv[3] : ""), dbskip:false, tnum : 1
              , conn: conn, limit:(process.argv[4] ?  process.argv[4] : "" ), interval: 0
              , exit: 1
            } ;
  new sendhttp(param) ;
})

// process.on('SIGINT', process.exit(0) );
// process.on('SIGTERM', endprog() );
// process.on('uncaughtException', (err) => { console.log('uncaughtException:', err) ; process.exit } ) ;
// process.on('exit', endprog() );
