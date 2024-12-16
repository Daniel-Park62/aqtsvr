"use strict";
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const LDIR = process.env.AQTLOG || '.' ;
module.exports = function(fname, msz = 100*1_000_000) {

  const logfname = path.resolve(LDIR,fname) ;
  console.log( logfname ) ;
  let clogfile = logfname ;
  let seq = 0 ;
  const wfs = fs.createWriteStream(clogfile,{flags:'a'}) ;
  process.stdout.write = process.stderr.write = wfs.write.bind(wfs) ;

  setInterval( () => {
    const stat = fs.statSync(clogfile) ;
    
    if (stat.size > msz ) {
      clogfile = logfname + '.' + ++seq ;
      const wfsx = fs.createWriteStream(clogfile,{flags:'a'}) ;
      process.stdout.write = process.stderr.write = wfsx.write.bind(wfsx) ;
    }
  }, 60*1000) ;

}