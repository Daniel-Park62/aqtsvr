"use strict";
const MAX_RESP_LEN = 1024 * 1024 * 2;
const SIZE_BLOB = 1024 * 1024 * 2;
const PGNM = '[capToDb_tcp]';
let con = require('../db/db_con');
// process.on('SIGTERM', endprog);
process.on('warning', (warning) => {
    console.warn(warning.name);    // Print the warning name
    console.warn(warning.message); // Print the warning message
    console.warn(warning.stack);   // Print the stack trace
});
let icnt = 0;
module.exports = function (args) {
    //    con = args.conn;
    const patt1 = new RegExp(args.dstip);
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
    let child = null;
    let ltype = 1;
    icnt = 0;
    let sv_ackno = 0;
    let sv_seqno = 0;
    console.log("%s Start 테스트id(%s) 대상(%s)", PGNM, args.tcode, args.dstv);
    try {
        if (!fs.statSync(args.dstv).isFile()) throw 'is not File';
        dstobj = args.dstv;
        process.on('SIGINT', () => process.exit(1));
    } catch (err) {
        // console.error(err);
        console.log(PGNM, "START tcpdump");
        const NETIP = (args.dstv ? ` && ( net ${args.dstv} ) ` : "");
        child = spawn('tcpdump -s0 -w - "tcp && tcp[13]&16 != 0 ', [ args.otherCond, '"'], { shell: true });
        dstobj = child.stdout;
        process.on('SIGINT', () => child.kill());
    }
    const parser = pcapp.parse(dstobj);
    parser.on('globalHeader', (gheader) => {
        ltype = gheader.linkLayerType;
        console.log(gheader);
    });
    let endsw = 1;
    parser.on('packet', async function (packet) {
        if (args.maxcnt > 0 && args.maxcnt <= icnt) {
            if (endsw) { endsw = 0; process.nextTick(endprog); }
            return;
        }
        let ret = decoders.Ethernet(packet.data);
        let ptime = moment.unix(packet.header.timestampSeconds).format('YYYY-MM-DD HH:mm:ss') + '.' + packet.header.timestampMicroseconds;
        let buffer = packet.data;
        if (ltype == 0) {
            ret.offset = 4;
            ret.info.type = PROTOCOL.ETHERNET.IPV4;
        } else if (ltype == 113) {
            ret.offset = 16;
            ret.info.type = PROTOCOL.ETHERNET.IPV4;
        }

        //            console.log(PGNM,packet.header, ret.info );
        if (1 || ret.info.type === PROTOCOL.ETHERNET.IPV4) {
            // console.log(PGNM,packet.data );
            ret = decoders.IPV4(buffer, ret.offset);
            // console.log(PGNM,ret) ;
            if (ret.info.totallen <= 40) return;
            // console.log(PGNM,'from: ' + ret.info.srcaddr + ' to ' + ret.info.dstaddr, 'total len ', ret.info.totallen);
            const srcip = ret.info.srcaddr;
            const dstip = ret.info.dstaddr;
            const ip_totlen = ret.info.totallen;
            if (ret.info.protocol === PROTOCOL.IP.TCP) {
                let datalen = ret.info.totallen - ret.hdrlen;
                // console.log(PGNM,'Decoding TCP ...');
                ret = decoders.TCP(buffer, ret.offset);
                //   console.log(PGNM,srcip,dstip,' from port: ' + ret.info.srcport + ' to port: ' + ret.info.dstport);
                datalen -= ret.hdrlen;
                // console.log(PGNM,'seqno ', ret.info.seqno, 'ackno ', ret.info.ackno, 'datalen ', datalen, ' next ', ret.info.seqno + datalen);
                // console.log(PGNM,ret) ;
                // console.log(PGNM,buffer.toString('binary', ret.offset, ret.offset + datalen));
                // console.log(PGNM,buffer.slice(ret.offset, ret.offset + 200).toString());
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
                    ky = util.format('%s:%d:%d', dstip, ret.info.dstport, ret.info.seqno + datalen);
                    if (datalen > 10 && datas.sdata.readUInt16BE() == 0x1234) ajp_parser(datas);
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
                        // console.log("del map", ky) ;
                        // if ( datas.seqno == 250453720 ) {
                        //     console.log("CHECK:", datas.srcip, datas.srcport, datas.dstip, datas.dstport, datas.sdata.toString() ) ;
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
                //                console.log(PGNM, 'Decoding UDP ...');
                ret = decoders.UDP(buffer, ret.offset);
                //                console.log(PGNM, ' from port: ' + ret.info.srcport + ' to port: ' + ret.info.dstport);
                //                console.log(PGNM, buffer.toString('binary', ret.offset, ret.offset + ret.info.length));
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
                ; //console.log(PGNM,'Unsupported IPv4 protocol: ' + PROTOCOL.IP[ret.info.protocol]);
        } else
            console.log(PGNM, 'Unsupported Ethertype: ' + PROTOCOL.ETHERNET[ret.info.type], ret.info.type);
    });
    parser.on('end', () => { setTimeout(endprog, 1000) });

    function write_rec(datas) {
        return new Promise(function (resolve, reject) {
            if (datas.slen > datas.sdata.length) reject();
            let pos = datas.sdata.indexOf(0x00);
            if (pos == -1) pos = datas.sdata.length;
            let rec = "~AQTD~" + datas.uri.padEnd(32, ' ') + datas.stime.padEnd(26, ' ') + datas.srcip.padEnd(15, ' ') + util.format('%d', datas.srcport).padStart(5, '0')
                + datas.dstip.padEnd(15, ' ') + util.format('%d', datas.dstport).padStart(5, '0') + util.format('%d', datas.seqno).padStart(15, '0')
                + util.format('%d', datas.ackno).padStart(15, '0') + util.format('%d', datas.slen).padStart(8, '0');
            let brec = Buffer.concat([Buffer.from(rec), datas.sdata.slice(0, pos)]);
            process.stdout.write(brec.length.toString().padStart(ISO_8601,'0') + brec);
            resolve(icnt++);
        });
    }

    async function insert_data(datas) {
        if (args.norcv == 'X') return await write_rec(datas) ;
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
			( ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?) ;",
            [args.tcode, datas.o_stime, datas.stime, datas.rtime, datas.srcip, datas.srcport, datas.dstip, datas.dstport, datas.proto,
            datas.method, datas.uri, datas.seqno, datas.ackno, datas.slen,
            datas.rdata.length, datas.sdata, datas.rdata, rcd, emsg])
            .then(row => {
                icnt++;
                icnt % 1000 == 0 && console.log(PGNM + "** insert ok %d 건", icnt);
            })
            .catch(err => {
                console.error(" insert error size(%d)", datas.rdata.length + datas.sdata.length, err);
                process.emit('SIGINT');
            });
    }
    async function endprog() {
        console.log("end process start");
        // myMap.forEach(async (datas, ky) => {
        for (let [ky, datas] of myMap) {
            if (!datas.rdata.length) continue;
            // if (datas.rhead.length > 0 || datas.rdata.length > 0) {
            // datas.rdata = bufTrim(datas.rdata);
            await insert_data(datas);
        };
        myMap.clear();
        console.log("%s *** Import completed (%d 건)***", PGNM, icnt);
        //        await con.end();
        process.exit();
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