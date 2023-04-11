"use strict";
const args = require('./cap_info');
args.tcode = process.argv[2];
args.dstv = process.argv[3] ;

args.conn = require('./db/db_con');

if (!args.dstv || !args.tcode ) {
    console.info("테스트id  대상호스트 ");
    process.exit(1);
}

let user_param = {} ;
try {
	if ( process.argv[4] ) user_param = JSON.parse(process.argv[4])  || {} ; 
} catch (e) {
	console.info(e);
	user_param = {} ;
}

console.info(user_param);

const cdb = require('./lib/capToDb') ;
// let qstr = "UPDATE texecjob set resultstat = 2, msg = concat(?,now(),':',?,'\r\n' ), endDt = now() where pkey = " + row.pkey ;
const param = {...args, ...user_param} ;

new cdb( param ) ;
