const net = require('net');
const moment = require('moment');
const ktoa = require('./lib/ktoainfo');
const cdate = () => moment().format("MM/DD HH:mm:ss.SSS :");
Object.keys(ktoa).forEach((k) => {

  const sock = net.connect({ port: 9000, host: ktoa[k].hostip, localAddress: ktoa[k].localip }, function () {
    console.log(cdate(), "connected ", this.localAddress);
    let sv_chunk = Buffer.from('');
    this.on('data', (d) => {
      sv_chunk = Buffer.concat([sv_chunk, d]);
      let lens = Number(sv_chunk.slice(0, 4));
      while (lens <= sv_chunk.length - 4) {
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

        this.write(sdat.slice(0, 60));
        lens = Number(sv_chunk.slice(0, 4));
        if (isNaN(lens) || lens == 0 ) {
          sv_chunk = Buffer.from('');
          break;
        }
      }
    });
    this.on('end', function () {
      console.log(k, 'disconnected.');
      //      clearInterval(intf); 
    });
    // 에러가 발생할때 에러메시지 화면에 출력
    this.on('error', function (err) {
      console.log(k, err);
    });
    // connection에서 timeout이 발생하면 메시지 출력
    this.on('timeout', function () {
      console.log(k, 'connection timeout.');
    });
  });

  //  let intf = setInterval(function(){
  //    let dat = '0056M' + moment().format('YYYYMMDDHHmmSS')  + '000000' + '0000' + '0'.repeat(15)
  //            + ' '.repeat(6) + '0' + k + ' '.repeat(6) ;
  //    console.log(cdate(), k, 'send :',dat.length,  dat) ;
  //		sock.write(dat);
  //	}, 2000);

})

process.on('uncaughtException', (err) => { console.error(cdate(), err) });