const crypto = require('../aqt_crypto');
const Net = require('net');
const moment = require('moment') ;
const BC_KEY = '81C05AED12756668';
const HNC_KEY = 'C1EEFF1FDE2917269A86B66916DFF138';
const BC_ALGOR = 'des';
const HNC_ALGOR = 'seed' ;
const BCR = '4243494E544D5347303030310310F23804010A400000000000000000040010910050010013155501100000000000000074001023110917683672110917102301000500331233313232333931373833303630313739313336353431332020202020203733363030333531383933373431313438323031313836202039343230323032302A2A2A2A333631393030303030303030303030373430303030303030303030303030303030303030303030303030303030303030302020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020203030303030302020202020202020203020202020202020202020202020202020202020202020202020202020202020303030303030303030303030303030303030303030303030303030202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020205434323030303030303030373030203030303030303030303030302020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020303530393037202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020202020FFEF'
const HNCR = 'EF0000000000EF0000000000EF0000000000EF0000000000EF0000000000EF0000000000EF0000000000EF0000000000EF0000000000EF0000000000EF0000000000EF0000000000EF0000000000EF0000000000EF0000000000EF0000000000EF0000000000EF0000000000EF0000000000EF0000000000FFEF49534F30323334303030353430383130383232303030303030323030303030303034303030303030303030303030303031303233303930303437303030383838303033303103' ;
/*
crypto.cipher('daniel Park', BC_KEY,BC_ALGOR)
.then( aa => {
  console.log(aa); 
  crypto.decipher(aa,BC_KEY,BC_ALGOR).then( aa => console.log(aa) ) ;
}) ;
crypto.encryptiv('78428934843999340929828283823', BC_KEY,BC_ALGOR)
.then( aa => {
  console.log(aa); 
  crypto.decryptiv(aa,BC_KEY,BC_ALGOR).then( aa => console.log(aa) ) ;
}) ;
*/
const port = process.argv[2] ?? 10002;
const server = new Net.Server();
server.listen(port, function() {
    console.log(`Server listening for connection requests on socket  port: ${port}`);
});
// When a client requests a connection with the server, the server creates a new
// socket dedicated to that client.
server.on('connection', function(socket) {
    console.log('A new connection has been established.');
    const rval = Buffer.concat([Buffer.from(' '.repeat(6)) , Buffer.from('FFFB19FFFD19','hex')]) ;
    socket.write(rval) ;
	console.log(rval.toString('hex'));
    let cok = 0 ;
    socket.on('data', function(chunk) {
		 
      //console.log("Data received from client:");
	  if (cok == 1 && chunk.slice(0,12).toString() == 'ISO023400053') {
//		  console.log(chunk.slice(0,12).toString()) ;
		  chunk.writeInt16BE(0x0810,12) ;
			socket.write(chunk) ;
	  } else if (cok == 1 && chunk.slice(0,4).toString() == '0800') {
			chunk.write('0810',0,4) ;
			chunk.write('00',52,2) ;
			socket.write(chunk) ;
	  } else if (cok == 1 && port == 10002  && chunk.length > 70)
        new dataProcBC(socket, chunk) ;
      else if (cok == 1  && chunk.length > 70 )
        new dataProcHNC(socket, chunk) ;
      if ( cok != 1 ) {
        const sval = chunk.slice(0,3).toString('hex').toLocaleUpperCase() ;
        if ( sval == 'FFFD19') {
          cok = 1;
        }
      }
    });
  
  // When the client requests to end the TCP connection with the server, the server
  // ends the connection.
  socket.on('end', function() {
      console.log('Closing connection with the client');
  });
  
  // Don't forget to catch error, for your own sake.
  socket.on('error', function(err) {
      console.log(`Error: ${err}`);
  });
  
    // The server can also receive data from the client by reading from its socket.
});
function dataProcBC(sock, dat) {
  this.socket = sock;
  const header = dat.slice(0,12) ;
  if (header != 'BCINTMSG0001' || header != 'ISO023400053' ) {
  }
  let trgb = dat.slice(12,14).toString('hex') ;
  let bmap1 = '';
  const cdate = moment().format("MMDDHHmmss") ;
  const bitmap1 = solution( parseInt(dat.slice(14,18).toString('hex'),16)) 
                + solution( parseInt(dat.slice(18,22).toString('hex'),16)) ;
  const bitmap2 = solution( parseInt(dat.slice(22,26).toString('hex'),16)) 
                + solution( parseInt(dat.slice(26,30).toString('hex'),16)) ;
  const bitmap3 = solution( parseInt(dat.slice(30,34).toString('hex'),16)) 
                + solution( parseInt(dat.slice(34,38).toString('hex'),16)) ;
  let bparr = ['0','0'].concat(bitmap1.split('').slice(1));
  if (bitmap1[0] == '1') bparr = bparr.concat('0',bitmap2.split('').slice(1)) ;
  if (bitmap2[0] == '1') bparr = bparr.concat(bitmap3.split('')) ;
  
  console.log(new Date(),'BC Messge Type:',bitmap1,bitmap2 );
  console.log(new Date(),'BC Messge Type:',bparr.length, bparr );
  console.log(dat.slice(14,38).toString('hex') );
  console.log(dat.slice(38,49).toString('hex') );
  let rdat = Buffer.from(dat.slice(0,14)) ;
  let bit55 = dat.slice(20,21).readUInt8() & 0xf0;
//  dat.writeUInt8(bit55,20) ;
  rdat = Buffer.concat([rdat, dat.slice(14,38)]) ;
  
  let pos = 38 ;
  for (let i = 2; i < bparr.length ; i++ ) {
	  if (bparr[i] == '0' ) continue ;
//	  console.log(i,pos,bclay[i]) ;
	  if (bclay[i] == undefined) continue ;
	  let len = 0 ;
	  if ( bclay[i].fv === 'v') {
		  if ( bclay[i].vl > 0 ) {
					len = parseInt(dat.slice(pos,pos+bclay[i].vl).toString());
		  } else {
			len = parseInt(dat.slice(pos,pos+1).toString('hex'),16) ;
			if ( bclay[i].t == 'b' ) len = Math.ceil(len/2) ; 
			len++ ;
		  }
	  } else if ( bclay[i].fv === 'f') {
		   len = bclay[i].l ;
	  } else
		  continue ;
//	  if (i == 118) {
//
		  //const rdat118 = Buffer.from('999041000'+sno+'0'.repeat(633)) ;
		  //console.log("118:",rdat118.length,"["+rdat118.toString('hex')+"]" ) ;
		  //rdat = Buffer.concat( [ rdat, rdat118 ]);
//	  } else if (i == 55) {
//		  const rdat55 = Buffer.from('0'.repeat(256)) ;
//		  rdat55.writeUInt8(255,0) ;
//		  rdat = Buffer.concat( [ rdat, rdat55]) ;
//		  len =  256 ;
//	  } else {
		let imdt = dat.slice(pos,pos+len) ;
			  const sno = Date.now().toString().substr(-8) ;	
		if (i == 118) {
			imdt.write(sno,5,8) ;
			imdt = imdt.slice(1) ;
		}
		console.log(i, "len:",len,imdt.toString('hex') ) ;
		rdat = Buffer.concat([rdat, imdt]) ;
//	  }
	  pos += len ;
  }
  if (trgb == '0300') {
    trgb = '0310'  ;
  } else {
    trgb = '0410' ;
  }
  rdat.write(trgb,12,2,'hex') ;
//  dat.write(cdate,60,5,'hex') ;
//  dat.write(cdate.substring(4),68,3,'hex') ;
//  dat.write(cdate,71,2,'hex') ;
  //console.log(dat.slice(0,14).toString()) ;
  console.log("last len:",rdat.length ) ;
  this.socket.write(rdat);
}
function dataProcHNC(sock, dat) {
  this.socket = sock;
  const header = dat.slice(0,12) ;
  if (header != 'ISO023400053' ) {
  }
  let trgb = dat.slice(12,14).toString('hex') ;
  const cdate = moment().format("MMDDHHmmss") ;
    const bitmap1 = solution( parseInt(dat.slice(14,18).toString('hex'),16)) 
                + solution( parseInt(dat.slice(18,22).toString('hex'),16)) ;
  const bitmap2 = solution( parseInt(dat.slice(22,26).toString('hex'),16)) 
                + solution( parseInt(dat.slice(26,30).toString('hex'),16)) ;
  let bparr = ['0','0'].concat(bitmap1.split('').slice(1));
  if (bitmap1[0] == '1') bparr = bparr.concat(bitmap2.split('')) ;
  
  console.log(new Date(),'HNC Messge Type:',bitmap1,bitmap2 );
  console.log(new Date(),'HNC Messge Type:',bparr.length, bparr );
  console.log(dat.slice(14,30).toString('hex') );
  console.log(dat.slice(30,41).toString('hex') );
  let rdat = Buffer.from(dat.slice(0,38)) ;
  let pos = 38 ;
  for (let i = 2; i < bparr.length ; i++ ) {
	  if (bparr[i] == '0') continue ;
	  console.log(i,pos,hnclay[i]) ;
	  if (hnclay[i] == undefined) continue ;
	  let len = 0 ;
	  if ( hnclay[i].fv === 'v') {
		  if ( hnclay[i].vl > 0 ) {
					len = parseInt(dat.slice(pos,pos+hnclay[i].vl).toString());
		  } else {
			len = parseInt(dat.slice(pos,pos+1).toString('hex'),16) ;
			if ( hnclay[i].t == 'b' ) len = Math.ceil(len/2) ; 
			len++ ;
		  }
	  } else if ( hnclay[i].fv === 'f') {
		   len = hnclay[i].l ;
	  } else
		  continue ;
	  if (i == 118 && len < 10) {
		  const sno = Date.now().toString().substr(-8) ;
		  rdat = Buffer.concat( [ rdat, Buffer.from('62041000'+sno+'0'.repeat(85)) ]);
		  console.log("sno:",sno ) ;
	  } else {
		console.log("len:",len,dat.slice(pos,pos+len).toString('hex') ) ;
		rdat = Buffer.concat([rdat, dat.slice(pos,pos+len)]) ;
	  }
	  pos += len ;
  }
  if (trgb == '0200') {
    trgb = '0210' ;
  } else if(trgb == '0220'){
    trgb = '0230' ;
  } else if(trgb == '0400'){
    trgb = '0410' ;
  } else if(trgb == '0800'){
    trgb = '0810' ;
  } else {
    trgb = '9'+trgb.substring(1) ;
  }
  rdat.write(trgb,12,2,'hex') ;
  //dat.write(cdate,50,5,'hex') ;
//  console.log(dat.slice(0,14).toString()) ;
  this.socket.write(rdat);
}
function solution(num)  {
  let answer = "";
  const dfs = (level) => {
    if (level === 0) return;
    else {
      dfs(Math.floor(level / 2));
      answer += level % 2;
    }
  };
  dfs(num);
  
  return ('0'.repeat(32) + answer).substr(-32);
}
const bclay = {
	2:{"l":11, "t":"b","fv":"v"},
	3:{"l":3, "t":"b","fv":"f"},
	4:{"l":8, "t":"b","fv":"f"},
	7:{"l":5, "t":"b","fv":"f"},
	11:{"l":3, "t":"b","fv":"f"},
	12:{"l":3, "t":"b","fv":"f"},
	13:{"l":2, "t":"b","fv":"f"},
	14:{"l":2, "t":"b","fv":"f"},
	18:{"l":2, "t":"b","fv":"f"},
	19:{"l":2, "t":"b","fv":"f"},
	22:{"l":2, "t":"b","fv":"f"},
	23:{"l":2, "t":"b","fv":"f"},
	25:{"l":1, "t":"b","fv":"f"},
	32:{"l":7, "t":"b","fv":"v"},
	35:{"l":20, "t":"b","fv":"v"},
	37:{"l":12, "t":"a","fv":"f"},
	39:{"l":2, "t":"a","fv":"f"},
	42:{"l":15, "t":"n","fv":"f"},
	44:{"l":26, "t":"a","fv":"v"},
	49:{"l":2, "t":"b","fv":"f"},
	52:{"l":8, "t":"b","fv":"f"},
	53:{"l":8, "t":"b","fv":"f"},
	55:{"l":256, "t":"e","fv":"v"},
	60:{"l":6, "t":"b","fv":"v"},
	70:{"l":2, "t":"b","fv":"f"},
	90:{"l":21, "t":"b","fv":"f"},
	118:{"l":650, "t":"n","fv":"v","vl":3},
	119:{"l":177, "t":"n","fv":"v","vl":3},
	126:{"l":83,"t":"a","fv":"v","vl":3},
	130:{"l":3,"t":"b","fv":"f"},
	131:{"l":5,"t":"b","fv":"f"},
	132:{"l":4,"t":"b","fv":"f"},
	134:{"l":16,"t":"b","fv":"f"},
	135:{"l":16,"t":"b","fv":"v"},
	136:{"l":8,"t":"b","fv":"f"},
	137:{"l":2,"t":"b","fv":"f"},
	138:{"l":2,"t":"b","fv":"f"},
	139:{"l":16,"t":"x","fv":"f"},
	142:{"l":255,"t":"b","fv":"v"},
	143:{"l":40,"t":"b","fv":"v"},
	144:{"l":1,"t":"b","fv":"f"},
	145:{"l":2,"t":"b","fv":"f"},
	146:{"l":3,"t":"b","fv":"f"},
	147:{"l":6,"t":"b","fv":"f"},
	148:{"l":2,"t":"b","fv":"f"},
	149:{"l":6,"t":"b","fv":"f"} }
	;
const hnclay = {
    2:{"l":11, "t":"b","fv":"v"},
	3:{"l":3, "t":"b","fv":"f"},
	4:{"l":6, "t":"b","fv":"f"},	
	7:{"l":5, "t":"b","fv":"f"},
	9:{"l":4, "t":"b","fv":"f"},
	10:{"l":4, "t":"b","fv":"f"},
	11:{"l":3, "t":"b","fv":"f"},
	22:{"l":2, "t":"b","fv":"f"}, 
	23:{"l":2, "t":"b","fv":"f"}, 
	25:{"l":1, "t":"b","fv":"f"},
	32:{"l":4, "t":"b","fv":"v"}, 
	35:{"l":20, "t":"b","fv":"v"}, 
	37:{"l":12, "t":"a","fv":"f"},
	39:{"l":2, "t":"a","fv":"f"},
	42:{"l":15, "t":"a","fv":"f"},
	47:{"l":74, "t":"a","fv":"v"}, 
	48:{"l":126, "t":"a","fv":"v"}, 
	49:{"l":2, "t":"b","fv":"f"}, 
	52:{"l":16, "t":"a","fv":"f"}, 
	55:{"l":256, "t":"a","fv":"v"}, 
	60:{"l":46, "t":"b","fv":"v"}, 
	70:{"l":2, "t":"b","fv":"f"},
	90:{"l":21, "t":"b","fv":"f"},
	118:{"l":98, "t":"a","fv":"v"},
	119:{"l":100, "t":"a","fv":"v"},
	126:{"l":80, "t":"a","fv":"v"},
};