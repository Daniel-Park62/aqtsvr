"use strict";
const args = {
  aqttype : '',
  tcode:null,
  dstip: '192.168.196.129',
  dstport:'8888' ,
  svcid:'',
  ptype:'F',
  dstv:null,
  otherCond :'', 
  norcv:null,  
  conn:null,
  maxcnt:0,
  jobId:0
} ;
const con = require('./db/db_con'); 
const moment = require('moment');
const cdate = () => "[aqtExecJob] " + moment().format("MM/DD HH:mm:ss.SSS :");
const logf = require('./lib/logfilec') ;
logf(moment().format("YYYYMMDDHHmm") + ".log") ;
console.log(cdate(), "* start Execute Job");
con.query("UPDATE texecjob set resultstat = 3, endDt = now() where resultstat = 1")
        .catch(err => console.error(err));
setInterval(() => {
  con.query("select pkey, jobkind, tcode, tnum,dbskip, exectype,etc,in_file, \
                  reqnum, repnum, limits, ifnull(msg,'') msg from texecjob \
                WHERE reqstartdt <= NOW() and resultstat=0 and jobkind in (1,9) \
                  AND TCODE in (select code from tmaster where pro != '3') order by reqstartdt LIMIT 1" )
    .then(rows => {
      if (rows.length == 0) return;
      con.query("UPDATE texecjob set resultstat = 1, startDt = now(), endDt = null where pkey = ?", [rows[0].pkey])
        .catch(err => console.error(cdate(),err));
      if (rows[0].jobkind == 1)
        importData(rows[0]);
      else
        sendData(rows[0]);
    })
    .catch(err => {
      console.log(cdate(), err);
      process.exit(1);
    });
}, 2 * 1000);
async function importData(row) {
  const cdb = require('./lib/capToDb');
  args.tcode = row.tcode;
  args.dstv = row.in_file;
  args.ptype = 'F';
  args.jobId = row.pkey;
  args.conn = await con.getConnection();
  new cdb(args);
}
function sendData(row) {
  con.query("SELECT lvl,if(pro='1','HTTP',IF(pro='2','UDP','TCP')) pro FROM TMASTER WHERE CODE = ?", [row.tcode])
    .then(async dat => {
      if (dat[0].lvl == '0') {
        console.log(cdate(), "Origin ID 는 테스트 불가합니다.");
        con.query("UPDATE texecjob set resultstat = 3, msg = 'Origin ID 는 테스트 불가합니다.', endDt = now() where pkey = ?", [row.pkey]);
        return;
      }
      const sendMain = require('./lib/sendMain');
      console.log(cdate(), "pid=>", process.pid);
      
      let param = {
        tcode: row.tcode, cond: row.etc, conn: await con.getConnection(), tnum:row.tnum, aqttype:dat[0].pro, exectype:row.exectype
        , limit: row.limits, interval: row.reqnum, loop: row.repnum , dbskip: row.dbskip == '1', jobId: row.pkey
      };
      sendMain(param);
    })
    .catch(err => {
      console.log(cdate(), err);
      con.query("UPDATE texecjob set resultstat = 3, msg = concat(?,now(),':',?,'\r\n' ), endDt = now() where pkey = ?", [row.msg, err, row.pkey]);
    });
}
function endprog() {
  console.log(cdate(), "## Exec job program End");
  con.end();
  process.exit(0)
}
process.on('SIGINT', endprog);
// process.on('SIGKILL',() => { console.log('KILL'); endprog; process.exit(0) } ); 
process.on('SIGTERM', endprog);
process.on('uncaughtException', (err) => { console.log(cdate(), 'uncaughtException:', err); });