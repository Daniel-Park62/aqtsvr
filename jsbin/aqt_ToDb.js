"use strict";

// if (! process.argv[2]) {
//     console.error("정보파일이 필요합니다.") ;
//     process.exit(1);
// }
if (process.argv.length < 3 ) {
    console.info(process.argv[1] , " 실행옵션정보파일이 필요합니다(cap_info.js 참조).");
    process.exit(1);
}

const info_file = process.argv[2] ;
const args = require(info_file) ;

if ( !args.dstv) {
    if( !process.argv[3]) {
        console.info(process.argv[1] , " 입력파일을 지정하세요.(dstv)");
        process.exit(1);
    } else {
        argv.dstv = process.argv[3] ;
    }
}

if ( !args.tcode) {
    console.info(process.argv[1] , " 테스트코드를 지정하세요.(tcode)");
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
