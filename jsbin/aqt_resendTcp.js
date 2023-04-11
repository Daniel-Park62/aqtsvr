"use strict";
const PGNM = '[Resend]';
const MAX_RESP_LEN = 1024 * 32;
const Dsec = /^\d+$/.test(process.argv[2])  ? process.argv[2] * 1 : 5 ;
const moment = require('moment');
const con = require('./db/db_con');
const Net = require('net');
const util = require('util') ;
moment.prototype.toSqlfmt = function (ms) {
    return this.format('YYYY-MM-DD HH:mm:ss.' + ms);
};

const dbskip = false ;
// const net = require("net");
// const client = new net.Socket();

console.log("%s * start check interval(%d sec)", PGNM,  Dsec) ;

setInterval(async () => {
		const con2 = await con.getConnection() ;
    const qstream = con2.queryStream("SELECT pkey FROM trequest order by reqDt  " );
    qstream.on("error", err => {
        console.log(PGNM,err); //if error
    });
    qstream.on("fields", meta => {
        // console.log(meta); // [ ...]
    });
    qstream.on("data", async row => {
        qstream.pause();
        
        await con.query("SELECT t.pkey,o_stime, if( ifnull(m.thost2,IFNULL(c.thost,''))>'',ifnull(m.thost2,c.thost) ,dstip) dstip, if(ifnull(m.tport2,IFNULL(c.tport,0))>0, ifnull(m.tport2,c.tport), dstport) dstport,uri,method,sdata, rlen " + 
          "FROM ttcppacket t join tmaster c on (t.tcode = c.code ) left join thostmap m on (t.tcode = m.tcode and t.dstip = m.thost and t.dstport = m.tport) " +
          "where t.pkey = ? ", [row.pkey])
					.catch(err => {
                    console.error("%s select error : %s ID(%d) ",PGNM, err, row.pkey  );
                    qstream.resume();
					})
					.then(row2 => {
                    dataHandle(row2[0], qstream );
                    con.query("DELETE FROM trequest where pkey = ?", [row.pkey]) ;
            }) ;
    });
    qstream.on("end", async () => {
			await con2.end() ;
    });
}, Dsec * 1000);

function dataHandle (rdata, qstream) {
  let stime = moment();
  let stimem = Math.ceil(process.hrtime()[1] / 1000) ;
  let sdataStr = rdata.sdata.toString() ;
	let recvData = [];
  stime = moment();
  stimem = Math.ceil(process.hrtime()[1] / 1000);

	const port = 20000;
	const host = 'localhost';

	// Create a new TCP client.
	const client = new Net.Socket();
	// Send a connection request to the server.
	client.connect({ port: rdata.dstport, host: rdata.dstip });

	// The client can also receive data from the server by reading from its socket.
	client.on('data', function(chunk) {
		recvData.push(chunk);
		// Request an end to the connection after the data has been received.
	});

	client.on('end', function() {
		  if ( dbskip) {
			qstream.resume();
			return;
		  }
		  const rtime = moment();
		  const rtimem = Math.ceil(process.hrtime()[1] / 1000);
		  if (rtimem < stimem && stime.isSame(rtime,'second') )  rtime.add('1','s') ;
		  const svctime = moment.duration(rtime.diff(stime)) / 1000.0;
		  // recvData[0] = bufTrim(recvData[0]);
		  let rDatas = Buffer.concat(recvData);
		  const rsz = rDatas.length;

		  con.query("UPDATE ttcppacket SET \
						rdata = ?, stime = ?, rtime = ?,  elapsed = ?, rcode = ? ,rlen = ? ,errinfo='',cdate = now() where pkey = ? "
			, [rDatas,  stime.toSqlfmt(stimem), rtime.toSqlfmt(rtimem), svctime, 1,  rsz, rdata.pkey])
			.catch(err => {
				console.error(PGNM, 'update error:', rdata.pkey, err);
			})
			.then( () => {
			    console.info(PGNM,"** update ok:", rdata.pkey);
			  qstream.resume();
			}) ;
		
	});
  
  client.on('error', function (e) {
		const emsg = util.format('%s(%d)',  e.message, e.errno );
		console.error('%s Error: %s', PGNM, emsg );
		const rtime = moment();
		const rtimem = Math.ceil(process.hrtime()[1] / 1000);

		const svctime = moment.duration(rtime.diff(stime)) / 1000.0;

		if (!dbskip)
			con.query("UPDATE ttcppacket SET \
							stime = ?, rtime = ?,  elapsed = ?, rcode = ? , errinfo = ? , cdate = now() where pkey = ?"
			, [stime.toSqlfmt(stimem), rtime.toSqlfmt(rtimem), svctime, 999, emsg, rdata.pkey])
			.catch(err => {
				console.error('update error:', err);
			})
			.finally( 	  qstream.resume()) ;
		else
			qstream.resume();

  });
	
	client.write(rdata.sdata);
  client.end();
}

function endprog() {
    console.log(PGNM,"program End");
    con.end() ;
}

process.on('SIGINT', ()=>{ endprog() ; process.exit(0);} );
process.on('uncaughtException', (err) => { console.log('uncaughtException:', err) ;endprog();  process.exit(1) } ) ;
