"use strict";
let aqttype ;
if ( process.env.AQTTYPE === 'TMAX') 
    aqttype = 'capToDb_tmax' ;
else if ( process.env.AQTTYPE === 'TCP') 
    aqttype = 'capToDb_tcp' ;
else if ( process.env.AQTTYPE === 'JEUS') 
    aqttype = 'capToDb_tcp_jeus' ;
else
    aqttype = 'capToDb' ;
const cdb = require('./lib/' + aqttype) ;

const args = require('./cap_info');
const conp = require('./db/db_con1') ;

args.tcode = process.argv[2];
args.dstv = process.argv[3] ;

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
conp.then( conn => {
    args.conn = conn ;
    const param = {...args, ...user_param} ;
    // console.log(param) ;
    new cdb( param ) ;
});
