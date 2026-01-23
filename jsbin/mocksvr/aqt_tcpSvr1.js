const crypto = require('../aqt_crypto');
const Net = require('net');
const moment = require('moment') ;
const { Socket } = require('dgram');

const BC_KEY = '81C05AED12756668';
const HNC_KEY = 'C1EEFF1FDE2917269A86B66916DFF138';
const BC_ALGOR = 'des';
const HNC_ALGOR = 'seed' ;
console.log( solution(parseInt('F012',16)) );
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
    console.log('A new connection has been established.', socket.address().address);
    const rval = Buffer.concat([Buffer.from(' '.repeat(6)) , Buffer.from('FFFB19FFFD19','hex')]) ;
    socket.write(rval) ;

    let cok = 0 ;
    socket.on('data', function(chunk) {

//      console.log("Data received from client:", cnt);
      if (cok == 1 && chunk.slice(0,12).toString() == 'ISO023400053') {
        chunk.writeInt16BE(0x0810,12) ;
        socket.write(chunk);
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
  let bitmap1 = dat.slice(14,22).toString()

  const cdate = moment().format("MMDDHHmmss") ;
  console.log('BC Messge Type:',trgb) ;
  if (trgb == '0300') {
    trgb = '0310'  ;
  } else {
    trgb = '0410'  ;
  }
  dat.write(trgb,12,10,'hex') ;
  dat.write(cdate,60,5,'hex') ;
  dat.write(cdate.substring(4),68,3,'hex') ;
  dat.write(cdate,71,2,'hex') ;

  this.socket.write(dat);
}

function dataProcHNC(sock, dat) {
  this.socket = sock;
  const header = dat.slice(0,12) ;
  if (header != 'ISO023400053' ) {

  }
  let trgb = dat.slice(12,14).toString('hex') ;

  const cdate = moment().format("MMDDHHmmss") ;
console.log('HNC Messge Type:',trgb) ;
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
  dat.write(trgb,12,2,'hex') ;
  dat.write(cdate,50,5,'hex') ;

  this.socket.write(dat);
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
  return answer;
}


const bc1_fl = {2:{"l":11,"fv":"v", "t":"b"}, 3:{"l":3,"fv":"f", "t":"b"}, 4:{"l":8,"fv":"f", "t":"b"}, 
                7:{"l":5,"fv":"f", "t":"b"},
                11:{"l":3,"fv":"f", "t":"b"},
                12:{"l":3,"fv":"f", "t":"b"},
                13:{"l":2,"fv":"f", "t":"b"},
                14:{"l":2,"fv":"f", "t":"b"},
                 11:3, 12:3, 13:2, 14:2, 22:2, 23:2,32:7, 
                 35:20,37:12,39:2,42:15,44:26,47:256,52:8, 
                 55:[
                  {"l":11,"fv":"v","t":"b"},
                  {"l":4,"fv":"v","t":"b"},
                 4,35,7,5,7,5,3,9,5,4,5,9,6,6,4,11,4,18,5,18
                ],
                 90:21,
                 118:[
                  {"l":3,"fv":"f","t":"n"},
                  {"l":2,"fv":"f","t":"n"},
                  {"l":8,"fv":"f","t":"a"}
                 ],
                 119:[3,1,12, 2, 1 ,16, 12, 12, 12,8,12,8,12,8,12,12,6,2,12,8,6],
                 126:83, 130:3,131:5, 132:4
                } ;