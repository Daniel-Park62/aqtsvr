"use strict";

// if (! process.argv[2]) {
//     console.error("정보파일이 필요합니다.") ;
//     process.exit(1);
// }
const info_file = process.argv[4] ??  './cap_info';
const args = require(info_file) ;
args.tcode = process.argv[2];
args.dstv = process.argv[3] ;
if (!args.dstv || !args.tcode ) {
    console.info(process.argv[1] , " 3개의 인수가 필요합니다.");
    console.info(process.argv[1] , " tcode  대상파일 정보파일");
    process.exit(1);
}

let aqttype = 'capToDb';

if (  args.aqttype.toUpperCase() === 'TMAX') 
    aqttype = 'capToDb_tmax' ;
else if ( args.aqttype.toUpperCase() === 'TCP') 
    aqttype = 'capToDb_tcp' ;
else if ( args.aqttype.toUpperCase() === 'UDP') 
    aqttype = 'capToDb_tcp' ;
else if ( args.aqttype.toUpperCase() === 'JEUS') 
    aqttype = 'capToDb_tcp_jeus' ;

const cdb = require('./lib/' + aqttype) ;

const conp = require('./db/db_con1') ;

/*
let user_param = {} ;
try {
	if ( process.argv[4] ) user_param = JSON.parse(process.argv[4])  || {} ; 
} catch (e) {
	console.info(e);
	user_param = {} ;
}
 console.info(user_param);
*/
conp.then( conn => {
    args.conn = conn ;
//    const param = {...args, ...user_param} ;
    // console.log(param) ;
    new cdb( args ) ;
});
