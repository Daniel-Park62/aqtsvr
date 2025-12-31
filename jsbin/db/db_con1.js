const mariadb = require('mariadb');
const config = require('./dbinfo').real;
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

module.exports = mariadb.createConnection(connection) ;
  

