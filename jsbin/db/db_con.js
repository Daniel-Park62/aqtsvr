const mariadb = require('mariadb');
const config = require('./dbinfo').real;
const connection = {
  // host: config.host,
  // port: config.port,
  socketPath: config.socketPath,
  user: config.user,
  password: config.password,
  database: config.database,
  idleTimeout : 60,
  acquireTimeout : 180000,
  connectionLimit: 5,
  bigIntAsNumber: true,
  insertIdAsNumber : true,
  decimalAsNumber : true,
  dateStrings : true ,
  validationQuery : 'select 1',
  testWhileIdle : true,
  timeBetweenEvictionRunsMillis: 1800000

} ;

module.exports =  mariadb.createPool(connection) ;
