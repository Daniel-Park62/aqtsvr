"use strict";
const loggerM = require('./lib/logs/aqtLogger');
const logger = loggerM.child({label:'dumpToDb'}) ;
if (process.argv.length < 3 ) {
    logger.info(" Job Id 를 지정하세요.");
    process.exit(1);
}
const jobid = process.argv[2] ;
let args = JSON.parse(process.argv[3]) ;
(async () => {
  const conp = await require('./db/db_con1') ;
  
  const rows = await conp.query("select jdata from texecjob where pkey = ?",[jobid]) ;
  
  if (! rows ) {
    logger.error("dump에 필요한 정보가 없습니다.")
    process.exit(1);
  }
  args = { ...args, ...rows[0].jdata} ;
  args.jobId = jobid ;
  args.conn = conp ;
  
  logger.info(JSON.stringify(args));

  args.logger = loggerM ;
  if ( !args.tcode) {
      logger.error( " 테스트코드를 지정하세요.(tcode)");
      process.exit(1);
  }

  if ( args.immd >= 1 ) {
    const childs = require("./lib/childReq");
    await childs.childs_start(args) ;
    args.sendf = childs.child_send ;
  }
  let aqtsrc = 'capToDb';

  if (  args.aqttype.toUpperCase() === 'TMAX') 
      aqtsrc = 'capToDb_tmax' ;
  else if ( /TCP|UDP/.test(args.aqttype.toUpperCase()) ) 
      aqtsrc = 'capToDb_tcp' ;
  else if ( args.aqttype.toUpperCase() === 'JEUS') 
      aqtsrc = 'capToDb_tcp_jeus' ;

  const cdb = require('./lib/' + aqtsrc) ;
  cdb( args ) ;

})();