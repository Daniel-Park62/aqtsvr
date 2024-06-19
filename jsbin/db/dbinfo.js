module.exports = {
    local: { // localhost
      host: 'localhost',
      port: process.env.AQTDBPORT  ||'3306',
      user: process.env.AQTDBUSER || 'aqtdb',
      password: process.env.AQTDBPASS || 'Dawinit1!',
      database: process.env.AQTDBNAME || 'aqtdb2',
      validationQuery : 'select 1', 
      testWhileIdle : true,
      timeBetweenEvictionRunsMillis : 3600000
    },
    real: { // real server db info
      host: process.env.AQTDBIP  ?? 'localhost',
      port: process.env.AQTDBPORT  ||'3306',
      user: process.env.AQTDBUSER || 'aqtdb',
      password: process.env.AQTDBPASS || 'Dawinit1!',
      database: process.env.AQTDBNAME || 'aqtdb2',
      validationQuery : 'select 1', 
      testWhileIdle : true,
      timeBetweenEvictionRunsMillis : 3600000
    },
    dev: { // dev server db info
      host: process.env.AQTDBIP  || '192.168.0.27',
      port: process.env.AQTDBPORT  ||'3306',
      user: process.env.AQTDBUSER || 'aqtdb',
      password: process.env.AQTDBPASS || 'Dawinit1!',
      database: process.env.AQTDBNAME || 'aqtdb2'
    }
  };
