"use strict";

const cdb = require('./lib/capToDb_tcp') ;
// const cdb = require('./lib/capToDb_tmax') ;
const args = require('./cap_info');
args.tcode = process.argv[2];
args.dstv = process.argv[3] ;

const con = require('./db/db_con');

if (!args.dstv || !args.tcode ) {
    console.info("( 테스트id  대상호스트 ) 를 입력하세요");
    process.exit(1);
}

let user_param = {} ;
try {
	if ( process.argv[4] ) user_param = JSON.parse(process.argv[4])  || {} ; 
} catch (e) {
	console.info(e);
	user_param = {} ;
}

// console.info(user_param);
con.getConnection().then( conn => {
    args.conn = conn ;
    const param = {...args, ...user_param} ;
    // console.log(param) ;
    new cdb( param ) ;
});
