const mariadb = require('mariadb');
const config = require('./dbinfo').real;
const connection = {
  supportBigNumbers: true,
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database
} ;

module.exports =  mariadb.createConnection(connection) ;
  

