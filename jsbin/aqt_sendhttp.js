"use strict";
/*
  �׽�Ʈid ���� limit 
*/
const MAX_RESP_LEN = 1024 * 32;
const v_tcode = process.argv[2] ;
if (undefined == v_tcode ) {
  console.info("�׽�ƮID�� �����ϼ���.") ;
  process.exit(1) ;
}

const con = require('./db/db_con');

const moment = require('moment');
const http = require('http');
moment.prototype.toSqlfmt = function () {
    return this.format('YYYY-MM-DD HH:mm:ss.SSSSSS');
};    

console.log("## Start send Data : ", v_tcode );

const sendhttp = require('./lib/sendHttp') ;
con.getConnection().then( conn => {
  let param = { tcode : v_tcode, cond: (process.argv[3] ?  process.argv[3] : "" )
              , conn: conn, limit:(process.argv[4] ?  process.argv[4] : "" ), interval: 0
            } ;
  sendhttp(param) ;
})

// process.on('SIGINT', process.exit(0) );
// process.on('SIGTERM', endprog() );
// process.on('uncaughtException', (err) => { console.log('uncaughtException:', err) ; process.exit } ) ;
// process.on('exit', endprog() );
