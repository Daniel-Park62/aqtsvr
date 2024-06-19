const crypto = require('./aqt_crypto');
const Net = require('net');
const moment = require('moment') ;

const BC_KEY = '81C05AED12756668';
const HNC_KEY = 'C1EEFF1FDE2917269A86B66916DFF138';
const BC_ALGOR = 'des';
const HNC_ALGOR = 'seed' ;


crypto.cipher('daniel Park', BC_KEY,BC_ALGOR)
.then( aa => {
  console.log(aa); 
  crypto.decipher(aa,BC_KEY,BC_ALGOR).then( aa => console.log(aa) ) ;
}) ;

/*
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
    socket.on('data', function(chunk) {
      console.log("Data received from client:");
      if (port == 10002)
        new dataProcBC(socket, chunk) ;
      else
        new dataProcHNC(socket, chunk) ;

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
  console.log('BC Messge Type:',trgb) ;
  if (trgb == '0300') {
    trgb = '0310' +  'F22406810A508000800000000000040000A000000000' ;
  } else {
    trgb = '0410' +  'F22406810A4080008000000000000400008000000000' ;
  }
  dat.write(trgb,12,10,'hex') ;
  dat.write(cdate,60,5,'hex') ;
  dat.write(cdate.substring(4),68,3,'hex') ;
  dat.write(cdate,71,2,'hex') ;
  console.log(dat.slice(0,14).toString()) ;
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
  console.log(dat.slice(0,14).toString()) ;
  this.socket.write(dat);
}