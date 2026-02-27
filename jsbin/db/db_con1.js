const mariadb = require('mariadb');
const config = require('./dbinfo.js');

const connection = {
  supportBigNumbers: true,
  host: config.host,
  port: config.port,
  // socketPath: config.socketPath,
  user: config.user,
  password: config.password,
  database: config.database,
  multipleStatements: true,
  dateStrings : true 
} ;
 console.log(connection);
module.exports = mariadb.createConnection(connection).catch(e => console.log("db_con1",e)) ;
  

