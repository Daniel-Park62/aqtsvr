"use strict";
const childs = require("./lib/childReq");
const loggerM = require('./lib/logs/aqtLogger'); 
const logger = loggerM.child({label:'resend'}) ;
const mdb = require('./db/db_con1') ;
const Dsec = /^\d+$/.test(process.argv[3]) ? process.argv[3] * 1 : 5;
const aqttype = process.argv[2] ? process.argv[2] : 'TCP' ;
let con;
let cnt=0;

async function main() {
  logger.info(`start ${aqttype}`) ;
  await childs.childs_start({logger, tnum:5,dbskip:0, aqttype}) ;

  con = await mdb;
  logger.info(`start Resend check ${Dsec} 초 단위`);
  // const sendhttp = require('./lib/sendHttp') ;
  setInterval(async () => {
    const rows = await con.query(`SELECT a.pkey FROM trequest a join tmaster t 
              on(a.tcode = t.code and t.pro = ${aqttype === 'TCP' ? '0' : '1'} ) order by a.reqDt  `);
              
    if (rows.length )
      for await (const row of rows) {
        childs.child_send(row.pkey) ;
        con.query("DELETE FROM trequest where pkey = ?", [row.pkey]) ;
        cnt++ ;
      };

  }, Dsec * 1000);

}

function endprog() {
  logger.info(`program End: ${cnt} 건 수행`);
  con.end();
  process.exit(0) ;
}

process.on('SIGINT', endprog);
process.on('SIGTERM', endprog);
process.on('uncaughtException', (err) =>  logger.info(`uncaughtException:${err.message}`) );
// process.on('exit', endprog);
main() ;