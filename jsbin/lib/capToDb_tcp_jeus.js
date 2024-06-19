"use strict";
const MAX_RESP_LEN = 1024 * 1024 * 2;
const SIZE_BLOB = 1024 * 1024 * 2; 
const PGNM = '[capToDb_tcp_jeus]';
let con ;
// process.on('SIGTERM', endprog);
process.on('warning', (warning) => {
    console.warn(warning.name);    // Print the warning name
    console.warn(warning.message); // Print the warning message
    console.warn(warning.stack);   // Print the stack trace
});
let icnt = 0 ;
module.exports = function (args) {  
    con = args.conn ;
    const patt1 = new RegExp(args.dstip) ;
    const patt2 = new RegExp(args.dstport.length > 0 ? args.dstport : '.');
    const myMap = new Map();
    const myMap_s = new Map();
    const { spawn } = require('child_process');
    const util = require('util');
    // const pcapp = require('./pcap-parser');
    const pcapp = require('./pcap-parser');
    const moment = require('moment');
    const decoders = require('./Decoders')
    const PROTOCOL = decoders.PROTOCOL;
    const fs = require('fs');
    let dstobj;
    let child = null ;
    let ltype = 1;
    icnt = 0 ;
    console.log("%s Start 테스트id(%s) 대상(%s)", PGNM,args.tcode, args.dstv);
    
    try {
        if (!fs.statSync(args.dstv).isFile()) throw 'is not File';
        dstobj = args.dstv;
    } catch (err) {
        // console.error(err);
        console.log(PGNM, "START tcpdump");
        const NETIP = (args.dstv ? ` && ( net ${args.dstv} ) ` : "");
        child = spawn('tcpdump -i2 -n -s0 -w - "', ["tcp && tcp[13]&16 != 0 ", NETIP,args.otherCond ,'"'], { shell: true });
        dstobj = child.stdout;
        process.on('SIGINT', () => child.kill());
    }
    
    const parser = pcapp.parse(dstobj);
    parser.on('globalHeader', (gheader)=> {
        ltype = gheader.linkLayerType ;
        console.log(gheader) ;
    });
    let endsw = 1;
    parser.on('packet', async function (packet) {
        if (args.maxcnt > 0 && args.maxcnt <= icnt) {
            if (endsw) { endsw = 0; process.nextTick( endprog);}
            return ;
        }
        let ret = decoders.Ethernet(packet.data);
        let ptime = moment.unix(packet.header.timestampSeconds).format('YYYY-MM-DD HH:mm:ss') + '.' + packet.header.timestampMicroseconds;
        let buffer = packet.data;
         if (ltype == 0) {
            ret.offset = 4 ;
            ret.info.type = PROTOCOL.ETHERNET.IPV4 ;
        } else if (ltype == 113) {
            ret.offset = 16 ;
            ret.info.type = PROTOCOL.ETHERNET.IPV4 ;
        }
 
//            console.log(PGNM,packet.header, ret.info );
        if (1 || ret.info.type === PROTOCOL.ETHERNET.IPV4) {
            // console.log(PGNM,packet.data );
            ret = decoders.IPV4(buffer,  ret.offset);
              // console.log(PGNM,ret) ;
            if (ret.info.totallen <= 40) return;
            // console.log(PGNM,'from: ' + ret.info.srcaddr + ' to ' + ret.info.dstaddr, 'total len ', ret.info.totallen);
            const srcip = ret.info.srcaddr;
            const dstip = ret.info.dstaddr;
            const ip_totlen = ret.info.totallen ;
            if (ret.info.protocol === PROTOCOL.IP.TCP) {
                let datalen = ret.info.totallen - ret.hdrlen;
                // console.log(PGNM,'Decoding TCP ...');
                ret = decoders.TCP(buffer, ret.offset);
                let ky = util.format('%s:%d:%d', srcip, ret.info.srcport, ret.info.ackno);
                // console.log(PGNM,' from port: ' + ret.info.srcport + ' to port: ' + ret.info.dstport);
                datalen -= ret.hdrlen;
                if (datalen <= 0) return;
                // console.log(PGNM,'seqno ', ret.info.seqno, 'ackno ', ret.info.ackno, 'datalen ', datalen, ' next ', ret.info.seqno + datalen);
                // console.log(PGNM,ret) ;
                // console.log(PGNM,buffer.toString('binary', ret.offset, ret.offset + datalen));
                // console.log(PGNM,buffer.slice(ret.offset, ret.offset + 200).toString());
                if (patt1.test(dstip) && patt2.test(ret.info.dstport.toString() )) {
                    // let sdata = buffer.slice(ret.offset, ret.offset + datalen);
                    if (myMap_s.has(ky)  && myMap.has(myMap_s.get(ky) ) ) {
                        let datas = myMap.get(myMap_s.get(ky)) ;
                        myMap.delete(myMap_s.get(ky)) ;
                        let ky2 = util.format('%s:%d:%d', dstip, ret.info.dstport, ret.info.seqno + datalen  );
                        datas.sdata = Buffer.concat([datas.sdata, buffer.slice(ret.offset)]) ;
                        datas.slen = datas.sdata.length ;
                        myMap_s.set(ky,ky2)
                        myMap.set(ky2, datas) ;
                        return ;
                    } 
                    let sdata = buffer.slice(ret.offset);
//                    if ( ! /Content-Length/i.test(sdata))  return ;
                    let datas = {
                        tcode: args.tcode,
                        method: 'POST',
                        // uri: decodeURIComponent(mdata[2].replace(/(.+)\/$/,'$1')) ,
                        o_stime: ptime,
                        stime: ptime,
                        rtime: ptime,
                        sdata: sdata,
                        slen: datalen,
                        rlen: -1,
                        srcip: srcip,
                        dstip: dstip,
                        srcport: ret.info.srcport,
                        dstport: ret.info.dstport,
                        seqno: ret.info.seqno,
                        ackno: ret.info.ackno,
                        rdata: '',
                        isUTF8: true
                    };
                    let sky = ky ;
                    ky = util.format('%s:%d:%d', dstip, ret.info.dstport,  ret.info.seqno + datalen  );
                    
                    myMap.set(ky, datas);
                    myMap_s.set(sky,ky);
                } else if (myMap.has(ky)) {
                    let datas = myMap.get(ky);
                    if (ptime > datas.stime) datas.rtime = ptime;
                    if (datas.rdata.length > 0)
                        datas.rdata = Buffer.concat([datas.rdata, buffer.slice(ret.offset) ]);
                    else
                        datas.rdata = buffer.slice(ret.offset) ;
                    
                    if ( /0\r\n\r\n$/.test(buffer.slice(ret.offset)) ) {
                    // if (ip_totlen < 1400 ) {
                        myMap.delete(ky);
                        // console.log("del map", ky) ;
                        // if ( datas.seqno == 250453720 ) {
                        //     console.log("CHECK:", datas.srcip, datas.srcport, datas.dstip, datas.dstport, datas.sdata.toString() ) ;
                        // }
                        // datas.rdata = bufTrim(datas.rdata);
                        await insert_data(datas ) ;
                    } else {
                        myMap.set(ky, datas);
                    }
                }
            } else if (ret.info.protocol === PROTOCOL.IP.UDP) {
                console.log(PGNM,'Decoding UDP ...');
                ret = decoders.UDP(buffer, ret.offset);
                console.log(PGNM,' from port: ' + ret.info.srcport + ' to port: ' + ret.info.dstport);
                console.log(PGNM,buffer.toString('binary', ret.offset, ret.offset + ret.info.length));
            } else
                ; //console.log(PGNM,'Unsupported IPv4 protocol: ' + PROTOCOL.IP[ret.info.protocol]);
        } else
            console.log(PGNM,'Unsupported Ethertype: ' + PROTOCOL.ETHERNET[ret.info.type], ret.info.type );
    });
    parser.on('end', ()=> { setTimeout( endprog, 1000) } ) ;
    
	async function insert_data(datas ) {
            datas = await parser_http(datas) ;
//		if (datas.hasOwnProperty('rhead' ) ) 
		if (datas.uri.length > 0 ) 
			return con.query("INSERT INTO TLOADDATA \
			(TCODE, O_STIME,STIME,RTIME, SRCIP,SRCPORT,DSTIP,DSTPORT,PROTO, METHOD, URI,SEQNO,ACKNO,slen,rlen,SDATA,RDATA, rhead) \
			values \
			( ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?) ;",
			[args.tcode, datas.o_stime, datas.stime, datas.rtime, datas.srcip, datas.srcport, datas.dstip, datas.dstport, '1',
				datas.method, datas.uri, datas.seqno, datas.ackno,  datas.slen,
				datas.rdata.length , datas.sdata, datas.rdata, datas.rhead ])
			.then( row => {
					icnt++ ;
					icnt % 1000 == 0 && console.log(PGNM + "** insert ok %d 건", icnt );
			})
			.catch( err => {
					console.error(" insert error size(%d)",datas.rdata.length + datas.sdata.length, err);
					process.emit('SIGINT') ;
			}) ;
		else
			return ;
	}
    async function endprog() {
		console.log("end process start") ;
        // myMap.forEach(async (datas, ky) => {
        for ( let [ky, datas ] of myMap ) {
            if ( ! datas.rdata.length  ) continue ;
            // if (datas.rhead.length > 0 || datas.rdata.length > 0) {
                // datas.rdata = bufTrim(datas.rdata);
            await insert_data(datas ) ;
            
        };
        myMap.clear();
        console.log("%s *** Import completed (%d 건)***", PGNM, icnt);
        await con.end();
        process.exit();
    }
    async function parser_http(datas) {
		const myHead = new Map();
        let bdata = datas.sdata.slice(96) ;
        let sdata = "";
        datas.uri = '';
        let hd1 = /000[34]M([A-Z]+)00/.exec(bdata) ;
        if (hd1) {
			sdata = hd1[1] + " "  ;
        	datas.method = hd1[1] ;
		}
        hd1 = /00\d\dR(.+?)00\d\d[C-R]/.exec(bdata) ;
        if (hd1) {
            let pos = hd1[1].indexOf('?') ;
            sdata += hd1[1] + " "  ;
            try {
                if (pos > 0)
                    datas.uri = decodeURIComponent(hd1[1].substring(0,pos)) ;
                else
                    datas.uri = decodeURIComponent(hd1[1]) ;
//                datas.uri = decodeURIComponent(hd1[1].replace(/(.+)[?/]?$/, '$1'));
            } catch (error) {
                console.error(hd1[1], error);
                if (pos > 0)
                    datas.uri = hd1[1].substring(0,pos) ;
                else
                    datas.uri = hd1[1] ;
//                datas.uri = hd1[1].replace(/(.+)[?/]?$/, '$1');
            }
//            if (! datas.uri )  datas.uri = hd1[1] ;
        }
        hd1 =  /0008P(.+?)00\d\d[C-R]/.exec(bdata) ;
        if (hd1) sdata += hd1[1]   ;
        sdata += "\r\n"; 
        [17,18,19,20,21,23,29,31,32,27,23,50,33,53,55,127].forEach( (x) => {
            let re = new RegExp("(?<=" + String(x).padStart(4,'0') + "H)(.+?)(?=0\\d{3}[C-R]|0000)",'g') ;
            let hl = bdata.toString().match(re) ;
            if (hl) {
				hl.forEach( hh => {
					if (myHead.has(hh) ) return ;
					hd1 = hh.replace("\t",": ") ;
					sdata += hd1 + "\r\n" ;
					myHead.set(hh,'') ;
				});
            }
        });
        sdata += "\r\n" ;
        let p = bdata.indexOf("0000");
        if (p >= 0)  sdata += bdata.slice(p+4) ;
        datas.sdata = sdata ;
        let rdata = datas.rdata.slice(96).toString().replace(/\0.*$/sg,'') ;
	    datas.rhead = '';
        p = rdata.indexOf("\r\n\r\n") ;
        if (p >= 0) {
            datas.rhead = Buffer.from(rdata.slice(0, p)) ;
            datas.rdata = Buffer.from(rdata.slice(p+4) ) ;
        }
        return datas ;
    }
}