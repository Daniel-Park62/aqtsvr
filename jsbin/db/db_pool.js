const mariadb = require('mariadb');
const config = require('./dbinfo').real;
const connection = {
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
  idleTimeout : 60,
  acquireTimeout : 180000,
  connectionLimit: 10
} ;

module.exports =  mariadb.createPool(connection) ;
