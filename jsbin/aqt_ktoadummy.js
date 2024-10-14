const net = require('net');
const moment = require('moment');
const ktoa = require('./lib/ktoainfo') ;
const cdate =  () => moment().format("MM/DD HH:mm:ss.SSS :");
Object.keys(ktoa).forEach( (k) => {
  
  const sock = net.connect( {port:9000, host:ktoa[k].hostip , localAddress: ktoa[k].localip }, function() {
    console.log(cdate(),"connected ", this.localAddress ) ;
    this.on('data', (d) => {
      console.log(cdate(), k, "received:", d.toString()  ) ;
	    const sdat = Buffer.from(d) ;
	    if (sdat.slice(51,54) !== k)  {

		if ( sdat.slice(51,52) == 'S' ) sdat.write('T',4) ;
		else if ( sdat.slice(51,52) == 'K' ) sdat.write('Y',4) ;
		else if ( sdat.slice(51,52) == 'L' ) sdat.write('Z',4) ;
	    } else {
	    	sdat.write(ktoa[k].GB,4) ;
	    }

//	    sdat.write( moment().format('YYYYMMDDHHmmSS') ,5) ;
	    sdat.write('000001',19);
	    sdat.write('SS0000',44);
	    console.log(sdat.toString());
	    this.write(sdat) ;
    }) ;
    this.on('end', function(){
      console.log(k, 'disconnected.');
//      clearInterval(intf); 
    });
    // 에러가 발생할때 에러메시지 화면에 출력
    this.on('error', function(err){
      console.log(k,err);
    });
    // connection에서 timeout이 발생하면 메시지 출력
    this.on('timeout', function(){
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
