"use strict";
const logger = require('./lib/logs/aqtLogger');

if (process.argv.length < 3 ) {
    logger.info(" Job Id 를 지정하세요.");
    process.exit(1);
}
const jobid = process.argv[2] ;

(async () => {
  const conp = await require('./db/db_con1') ;
  
  const rows = await conp.query("select jdata from texecjson where pkey = ?",[jobid]) ;
  
  if (! rows ) {
    logger.error("dump에 필요한 정보가 없습니다.")
    process.exit(1);
  }
  const args = rows[0].jdata ;
  args.conn = conp ;
  logger.info(args);

  if ( !args.tcode) {
      logger.error( " 테스트코드를 지정하세요.(tcode)");
      process.exit(1);
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