"use strict";
const MAX_RESP_LEN = 1024 * 1024 * 2;
const SIZE_BLOB = 1024 * 1024 * 2;
const PGNM = '[capToDb_tcp]';
let con;
let logger ;

process.on('warning', (warning) => {
    logger.warn(warning.name);    // Print the warning name
    logger.warn(warning.message); // Print the warning message
    logger.warn(warning.stack);   // Print the stack trace
});
let icnt = 0;
module.exports = function (args) {
    logger = args.logger.child({label:'catToDb_tcp'}) ;

    process.on('SIGTERM', endprog);

    con = args.conn;
    const patt1 = new RegExp(args.dstip);
    const patt2 = new RegExp(args.dstport.length > 0 ? args.dstport : '.');
    const myMap = new Map();
    const myMap_s = new Map();
    const { spawn } = require('child_process');
    const util = require('util');
    // const pcapp = require('./pcap-parser');
    const pcapp = require('./pcap-parser');
    const decoders = require('./Decoders')
    const PROTOCOL = decoders.PROTOCOL;
    const fs = require('fs');
    let dstobj;
    let child = null;
    let ltype = 1;
    icnt = 0;
    let sv_ackno = 0;
    let sv_seqno = 0;
    logger.info(` Start 테스트id(${args.tcode}) 대상(${args.dstf})`) ;
    if (args.ptype == 'F') {
        if (!fs.statSync(args.dstf).isFile()) throw 'is not File';
        dstobj = args.dstf;
        process.on('SIGINT', endprog);
    } else {
        let conds = 'tcp && tcp[13]&16 != 0 ';
        conds += (args.dstip ? ` && ( net ${args.dstip} ) ` : "");
        conds += (args.otherCond ? ` &&  ${args.otherCond} ` : "");
        logger.info( `tcpdump -s0 -w - ${args?.otherOpt} " ${conds} "` );
        child = spawn(`tcpdump -s0 -w - ${args?.otherOpt} `, ['"' , conds ,'"'], { shell: true });
        dstobj = child.stdout;
        process.on('SIGINT', () => child.kill());
    }
    const parser = pcapp.parse(dstobj);
    parser.on('globalHeader', (gheader) => {
        ltype = gheader.linkLayerType;
        logger.info(gheader);
    });
    let endsw = 1;
    parser.on('packet', async function (packet) {
        if (args.maxcnt > 0 && args.maxcnt <= icnt) {
            if (endsw) { endsw = 0; process.nextTick(endprog); }
            return;
        }
        let ret = decoders.Ethernet(packet.data);
//        let ptime = moment.unix(packet.header.timestampSeconds).format('YYYY-MM-DD HH:mm:ss') + '.' + packet.header.timestampMicroseconds;
        let ptime = packet.header.timestampSeconds + (packet.header.timestampMicroseconds / 1_000_000);
        let buffer = packet.data;
        if (ltype == 0) {
            ret.offset = 4;
            ret.info.type = PROTOCOL.ETHERNET.IPV4;
        } else if (ltype == 113) {
            ret.offset = 16;
            ret.info.type = PROTOCOL.ETHERNET.IPV4;
        }

        if (1 || ret.info.type === PROTOCOL.ETHERNET.IPV4) {
            // logger.info(packet.data );
            ret = decoders.IPV4(buffer, ret.offset);
            // logger.info(ret) ;
            if (ret.info.totallen <= 40) return;
            // logger.info('from: ' + ret.info.srcaddr + ' to ' + ret.info.dstaddr, 'total len ', ret.info.totallen);
            const srcip = ret.info.srcaddr;
            const dstip = ret.info.dstaddr;
            const ip_totlen = ret.info.totallen;
            if (ret.info.protocol === PROTOCOL.IP.TCP) {
                let datalen = ret.info.totallen - ret.hdrlen;
                // logger.info('Decoding TCP ...');
                ret = decoders.TCP(buffer, ret.offset);
                //   logger.info(srcip,dstip,' from port: ' + ret.info.srcport + ' to port: ' + ret.info.dstport);
                datalen -= ret.hdrlen;
                // logger.info('seqno ', ret.info.seqno, 'ackno ', ret.info.ackno, 'datalen ', datalen, ' next ', ret.info.seqno + datalen);
                // logger.info(ret) ;
                // logger.info(buffer.toString('binary', ret.offset, ret.offset + datalen));
                // logger.info(buffer.slice(ret.offset, ret.offset + 200).toString());
                let ky = util.format('%s:%d:%d', srcip, ret.info.srcport, ret.info.ackno);
                if (patt1.test(dstip) && patt2.test(ret.info.dstport.toString())) {
                    // let sdata = buffer.slice(ret.offset, ret.offset + datalen);
                    if (myMap_s.has(ky) && myMap.has(myMap_s.get(ky))) {
                        let datas = myMap.get(myMap_s.get(ky));
                        if (sv_seqno == ret.info.seqno && sv_ackno == ret.info.ackno) { // 23.12.28 add
                            sv_seqno = ret.info.seqno;
                            sv_ackno = ret.info.ackno;
                            return;
                        }
                        myMap.delete(myMap_s.get(ky));
                        let ky2 = util.format('%s:%d:%d', dstip, ret.info.dstport, ret.info.seqno + datalen);
                        datas.sdata = Buffer.concat([datas.sdata, buffer.slice(ret.offset)]);
                        datas.slen = datas.sdata.length;
                        myMap_s.set(ky, ky2)
                        myMap.set(ky2, datas);
                        sv_seqno = ret.info.seqno;
                        sv_ackno = ret.info.ackno;
                        return;
                    }
                    if (datalen <= 0) return;
                    let sdata = buffer.slice(ret.offset);
                    let datas = {
                        tcode: args.tcode,
                        method: '',
                        uri: '',
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
                        proto: '0',
                        isUTF8: true
                    };
                    let sky = ky;
                    if (datalen > 10 && datas.sdata.readUInt16BE() == 0x1234) ajp_parser(datas);
                    if (args.norcv && datas.slen <= datas.sdata.length) {
                        insert_data(datas);
                        return;
                    }
                    ky = util.format('%s:%d:%d', dstip, ret.info.dstport, ret.info.seqno + datalen);
                    myMap.set(ky, datas);
                    myMap_s.set(sky, ky);
                    sv_seqno = ret.info.seqno;
                    sv_ackno = ret.info.ackno;
                } else if (myMap.has(ky)) {
                    let datas = myMap.get(ky);
                    if (ptime > datas.stime) datas.rtime = ptime;
                    if (datas.rdata.length > 0 && Buffer.compare(datas.rdata, buffer.slice(ret.offset)) != 0)
                        datas.rdata = Buffer.concat([datas.rdata, buffer.slice(ret.offset)]);
                    else
                        datas.rdata = buffer.slice(ret.offset);
                    if (datas.rdata.length < 6 || ip_totlen < 1400 && datas.rdata.length > 5 && (!datas.rdata.readUInt16BE() != 0x4142 || !datas.rdata.readUInt8(4) != 4)) {
                        myMap.delete(ky);
                        // logger.info("del map", ky) ;
                        // if ( datas.seqno == 250453720 ) {
                        //     logger.info("CHECK:", datas.srcip, datas.srcport, datas.dstip, datas.dstport, datas.sdata.toString() ) ;
                        // }
                        // datas.rdata = bufTrim(datas.rdata);
                        await insert_data(datas);
                    } else {
                        sv_seqno = ret.info.seqno;
                        sv_ackno = ret.info.ackno;
                        myMap.set(ky, datas);
                    }
                }
            } else if (ret.info.protocol === PROTOCOL.IP.UDP) {
                //                logger.info( 'Decoding UDP ...');
                ret = decoders.UDP(buffer, ret.offset);
                //                logger.info( ' from port: ' + ret.info.srcport + ' to port: ' + ret.info.dstport);
                //                logger.info( buffer.toString('binary', ret.offset, ret.offset + ret.info.length));
                let datas = {
                    tcode: args.tcode,
                    method: '',
                    uri: '',
                    o_stime: ptime,
                    stime: ptime,
                    rtime: ptime,
                    sdata: buffer.slice(ret.offset, ret.offset + ret.info.length),
                    slen: ret.info.length,
                    rlen: 0,
                    srcip: srcip,
                    dstip: dstip,
                    srcport: ret.info.srcport,
                    dstport: ret.info.dstport,
                    seqno: 0,
                    ackno: 0,
                    rdata: '',
                    proto: '2'
                };
                await insert_data(datas);
            } else
                ; //logger.info('Unsupported IPv4 protocol: ' + PROTOCOL.IP[ret.info.protocol]);
        } else
            logger.info( 'Unsupported Ethertype: ' + PROTOCOL.ETHERNET[ret.info.type], ret.info.type);
    });
    parser.on('end', () => { setTimeout(endprog, 1000) });

    function write_rec(pid) {
        let rec = "~AQTD~" + util.format('%d', pid).padStart(15, '0') + "\n";
        process.stdout.write(rec);
    }

    async function insert_data(datas) {
        let rcd = 0;
        let emsg = null;
        // AJP 일때 응답코드값 
        if (datas.rdata.length > 5 && datas.rdata.readUInt16BE() == 0x4142 && datas.rdata.readUInt8(4) == 4) {
            rcd = datas.rdata.readUInt16BE(5);
            if (rcd > 399) emsg = datas.rdata.subarray(9, 10 + datas.rdata.readUInt16BE(7)).toString();
        }

        return con.query("INSERT INTO TLOADDATA \
			(TCODE, O_STIME,STIME,RTIME, SRCIP,SRCPORT,DSTIP,DSTPORT,PROTO, METHOD,URI,SEQNO,ACKNO,slen,rlen,SDATA,RDATA,rcode,errinfo) \
			values \
			( ?,from_unixtime(?),from_unixtime(?),from_unixtime(?),?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?) ;",
            [args.tcode, datas.o_stime, datas.stime, datas.rtime, datas.srcip, datas.srcport, datas.dstip, datas.dstport, datas.proto,
            datas.method, datas.uri, datas.seqno, datas.ackno, datas.slen,
            datas.rdata.length, datas.sdata, datas.rdata, rcd, emsg])
            .then(row => {
                if (args?.imm == 1) write_rec(dt.insertId) ;
                icnt++;
                icnt % 1000 == 0 && logger.info(PGNM + "** insert ok %d 건", icnt);
            })
            .catch(err => {
                logger.error(` insert error ${err}`); 
                process.emit('SIGINT');
            });
    }
    async function endprog() {
        logger.info("end process start");
        // myMap.forEach(async (datas, ky) => {
        for (let datas of myMap.values()) {
            if (!datas.slen) continue;
            await insert_data(datas);
        };
        myMap.clear();
        if (args.jobId) {
            await con.query("UPDATE texecjob set resultstat = 2, msg = concat(msg,now(),':',?,'\r\n' ), endDt = now() where pkey = ? ",
                [icnt + " 건 Import", args.jobId]);
        }
        await con.end();

        logger.info(` *** Import completed (${icnt} 건)***`);
        process.exit(0);
    }
    function ajp_parser(datas) {
        let sz = datas.sdata.readUInt16BE(2);
        if (sz < 11) return;
        switch (datas.sdata.readUInt8(5)) {
            case 2:
                datas.method = 'GET'; break;
            case 4:
                datas.method = 'POST'; break;
            case 5:
                datas.method = 'PUT'; break;
            case 6:
                datas.method = 'DELETE'; break;
            default:
                return;
        }
        sz = datas.sdata.readUInt16BE(6); // protocol size -> HTTP/1.1
        let sz2 = datas.sdata.readUInt16BE(8 + sz + 1); // URI SIZE
        datas.uri = datas.sdata.subarray(8 + sz + 3, 8 + sz + 3 + sz2);
    }
}