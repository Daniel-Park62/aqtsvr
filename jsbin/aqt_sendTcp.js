"use strict";

const MAX_RESP_LEN = 1024 * 32;
const v_tcode = process.argv[2] ;
if (undefined == v_tcode ) {
  console.info("테스트ID를 지정하세요.") ;
  process.exit(1) ;
}

const moment = require('moment');

moment.prototype.toSqlfmt = function () {
    return this.format('YYYY-MM-DD HH:mm:ss.SSSSSS');
};    

console.log("## Start send Data : ", v_tcode );

const sendTcp = require('./lib/sendTcp') ;

let param = { tcode : v_tcode, cond: (process.argv[3] ?  process.argv[3] : "" )
            , limit:(process.argv[4] ?  process.argv[4] : "" ), interval: 0
           } ;
let execjob = () => new sendTcp(param) ;

execjob() ;

// process.on('SIGINT', process.exit(0) );
// process.on('SIGTERM', endprog() );
// process.on('uncaughtException', (err) => { console.log('uncaughtException:', err) ; process.exit } ) ;
// process.on('exit', endprog() );
