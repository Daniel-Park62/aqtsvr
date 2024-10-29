const net = require('net');
const moment = require('moment');
const ktoa = require('./lib/ktoainfo');
const cdate = () => moment().format("MM/DD HH:mm:ss:");
Object.keys(ktoa).forEach((k) => {

  //  const sock = net.createConnection({ port: 9000, host: ktoa[k].hostip, localAddress: ktoa[k].localip });
  const sock = net.createConnection({ port: ktoa[k].port, host: ktoa[k].hostip });
  sock.reconnect = (iv) => {
    setTimeout(() => {
      console.log(cdate(), k, 'Try Reconnect');
      sv_chunk = Buffer.from('');
      sock.connect({ port: ktoa[k].port, host: ktoa[k].hostip });
    }, iv);
  }
  sock.on('connect', () => {
    console.log(cdate(), "connected ", k, ktoa[k].localip);
  });
  let sv_chunk = Buffer.from('');
  sock.on('data', (d) => {
    console.log(cdate(),'Re:',d.toString()) ;
    sv_chunk = Buffer.concat([sv_chunk, d]);
    let lens = Number(sv_chunk.slice(0, 4));
    while (lens > 0 && lens <= sv_chunk.length - 4) {
      let sdat = Buffer.from(sv_chunk.slice(0, lens + 4));
      console.log(cdate(), k, "received:", sdat.toString());
      sv_chunk = sv_chunk.slice(lens + 4);

      if (Number(sdat.slice(52, 54)) >= 0) {
        if (sdat.slice(51, 52) == 'S') sdat.write('T', 4);
        else if (sdat.slice(51, 52) == 'K') sdat.write('Y', 4);
        else sdat.write('Z', 4);
      } else
        sdat.write(ktoa[k].GB, 4)
      //	    sdat.write( moment().format('YYYYMMDDHHmmSS') ,5) ;
      const bgb = (Number(sdat.slice(25, 29)) + 1).toString().toString().padStart(4, '0');
      console.log(bgb);
      sdat.write(bgb, 25);
      sdat.write('SS0000', 44);
      sdat.write('0056', 0);
      console.log(sdat.slice(0, 60).toString());

      sock.write(sdat.slice(0, 60));
      lens = Number(sv_chunk.slice(0, 4));
      if (isNaN(lens) || lens == 0) {
        break;
      }
    }
  });
  sock.on('close', function () {
    console.log(cdate(), k, 'close.');
    sock.reconnect(3000);
  });
  // 에러가 발생할때 에러메시지 화면에 출력
  sock.on('error', function (err) {
    console.log(cdate(), k, err.message);
  });
  // connection에서 timeout이 발생하면 메시지 출력
  sock.on('timeout', function () {
    console.log(cdate(), k, 'connection timeout.');
  });
});

process.on('uncaughtException', (err) => { console.error(cdate(), err) });