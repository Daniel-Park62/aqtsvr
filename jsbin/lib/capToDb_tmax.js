"use strict";

const MAX_RESP_LEN = 1024 * 1024 * 2;
const SIZE_BLOB = 1024 * 1024 * 2;
const PGNM = "capToDb_tmax";
const { resolve } = require('path');
require('events').EventEmitter.defaultMaxListeners = Infinity ;

let con, child;

process.on('warning', (warning) => {
    console.warn(warning.name);    // Print the warning name
    console.warn(warning.message); // Print the warning message
    console.warn(warning.stack);   // Print the stack trace
});
let icnt = 0;

module.exports = function (args) {
    con = args.conn;
    const patt1 = new RegExp(args.dstip);
    const patt2 = new RegExp(args.dstport.length > 0 ? args.dstport : '.');
    const patt_svc = new RegExp(args.svcid);
    const myMap = new Map();
    const myMap_s = new Map();
    const { spawn } = require('child_process');

    const util = require('util');
    const pcapp = require('./pcap-parser');

    const moment = require('moment');
    const decoders = require('./Decoders')
    const PROTOCOL = decoders.PROTOCOL;
    const fs = require('fs');
    let dstobj;
    let ltype = 1;
    let workTime = new Date();

    icnt = 0;
    console.log("%s Start ", PGNM, args.tcode, args.dstv);

    if (args.ptype == 'F') {
        if (!fs.statSync(args.dstv).isFile()) throw 'is not File';
        dstobj = args.dstv;
    } else {

        console.log(PGNM, "START tcpdump");
        
        child = spawn('tcpdump -s0 -w - "tcp && tcp[13]&16 != 0 && net ',
             [ args.dstip, args.otherCond, '"', args.otherOpt ], { shell: true });
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
            if (endsw) { endsw = 0; endprog(); }
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
        if (ret.info.type === PROTOCOL.ETHERNET.IPV4) {
            // console.log(PGNM,'Decoding IPv4 ...');

            ret = decoders.IPV4(buffer, ret.offset);
            //   console.log(PGNM,ret) ;
            if (ret.info.totallen <= 40) return;
            // console.log(PGNM,'from: ' + ret.info.srcaddr + ' to ' + ret.info.dstaddr, 'tottal len ', ret.info.totallen);
            const srcip = ret.info.srcaddr;
            const dstip = ret.info.dstaddr;
            const ip_totlen = ret.info.totallen;
            if (ret.info.protocol === PROTOCOL.IP.TCP) {
                let datalen = ret.info.totallen - ret.hdrlen;

                ret = decoders.TCP(buffer, ret.offset);
                // console.log(PGNM,' from port: ' + ret.info.srcport + ' to port: ' + ret.info.dstport);
                datalen -= ret.hdrlen;

                // console.log(PGNM,'seqno ', ret.info.seqno, 'ackno ', ret.info.ackno, 'datalen ', datalen, ' next ', ret.info.seqno + datalen);
                // console.log(PGNM,ret) ;
                // console.log(PGNM,buffer.toString('binary', ret.offset, ret.offset + datalen));
                // console.log(PGNM,buffer.slice(ret.offset, ret.offset + 200).toString());
                let ky = util.format('%s:%d:%d', srcip, ret.info.srcport, ret.info.ackno);
                // console.log(PGNM,'Decoding TCP ...', dstip, ret.info.dstport);

                if (patt1.test(dstip) && patt2.test(ret.info.dstport.toString())) {
                    // console.log(PGNM,srcip, dstip, ret.info.dstport);
                    // let sdata = buffer.slice(ret.offset, ret.offset + datalen);
                    if (myMap_s.has(ky) && myMap.has(myMap_s.get(ky))) {
                        let datas = myMap.get(myMap_s.get(ky));
                        myMap.delete(myMap_s.get(ky));
                        let ky2 = util.format('%s:%d:%d', dstip, ret.info.dstport, ret.info.seqno + datalen);
                        datas.sdata = Buffer.concat([datas.sdata, buffer.slice(ret.offset)]);
                        if (args.norcv && (datas.slen <= datas.sdata.length || ret.info.flags & 0x08)) {
                            insert_data(datas);
                            myMap_s.delete(ky);
                            return;
                        }
                        //                        datas.slen = datas.sdata.length ;
                        myMap_s.set(ky, ky2)
                        myMap.set(ky2, datas);
                        return;
                    }
                    if (datalen <= 0) return;
                    let sdat = buffer.slice(ret.offset);
                    //			console.log(sdat.slice(0,136) );
                    if (sdat.readUInt16BE() != 0x9035) return;
                    if (sdat.length < 12) return;
//                    if (sdat.readUInt32BE(8) != 2) return;
                    let svcnm = sdat.slice(68, 100);
                    let ci = svcnm.indexOf(0x00);
                    if (ci != -1) svcnm = svcnm.slice(0, ci);
                    // ci = buffer.indexOf('000022b8',ret.offset+86, 'hex') ;
                    if (args.svcid && !patt_svc.test(svcnm)) return;
                    // if (ci < 0) return ;
                    sdat = buffer.slice(ret.offset + 136);
                    if (buffer.slice(ret.offset + 100, ret.offset + 104).readUInt32BE() == 0) {
                        console.log("BUFFER:", buffer.slice(24, 40));
                        return;
                    }
                    //					if ( ret.info.ackno == 3000257998 ) console.log(svcnm.toString() ,sdat.slice(0,20), sdat.readUInt32BE(4)  ) ;
                    let datas = {
                        tcode: args.tcode,
                        // method: mdata[1],
                        uri: svcnm.toString(),
                        o_stime: ptime,
                        stime: ptime,
                        rtime: ptime,
                        sdata: sdat,
                        slen: buffer.slice(ret.offset + 100, ret.offset + 104).readUInt32BE(),
                        rlen: -1,
                        srcip: srcip,
                        dstip: dstip,
                        srcport: ret.info.srcport,
                        dstport: ret.info.dstport,
                        seqno: ret.info.seqno,
                        ackno: ret.info.ackno,
                        rdata: Buffer.from(''),
                        isUTF8: true
                    };

                    if (args.norcv && datas.slen <= datas.sdata.length) {
                        insert_data(datas);
                        return;
                    }
                    let sky = ky;
                    ky = util.format('%s:%d:%d', dstip, ret.info.dstport, ret.info.seqno + datalen);

                    //			if (datas.seqno == 3096352362) console.log(datas.sdata.slice(52,52+30) ) ;
                    myMap.set(ky, datas);
                    myMap_s.set(sky, ky);

                } else if (args.norcv) {
                    return;
                } else if (myMap.has(ky)) {

                    let datas = myMap.get(ky);
                    let rdata = buffer.slice(ret.offset);
                    if (rdata.length < 100) return;
                    if (rdata.readUInt16BE() == 0x9035) {
                        datas.rdata = rdata.slice(136);
                        datas.rlen = buffer.slice(ret.offset + 100, ret.offset + 104).readUInt32BE();
                        if (ptime > datas.stime) datas.rtime = ptime;
                    } else {
                        datas.rdata = Buffer.concat([datas.rdata, rdata]);
                    }

                    if (datas.rlen <= datas.rdata.length || ret.info.flags & 0x08) {
                        myMap.delete(ky);
                        // console.log("del map", ky) ;
                        // if ( datas.seqno == 250453720 ) {
                        //     console.log("CHECK:", datas.srcip, datas.srcport, datas.dstip, datas.dstport, datas.sdata.toString() ) ;
                        // }
                        // datas.rdata = bufTrim(datas.rdata);
                        insert_data(datas);
                    } else {
                        myMap.set(ky, datas);
                    }
                }

            } else if (ret.info.protocol === PROTOCOL.IP.UDP) {
                console.log(PGNM, 'Decoding UDP ...');

                ret = decoders.UDP(buffer, ret.offset);
                console.log(PGNM, ' from port: ' + ret.info.srcport + ' to port: ' + ret.info.dstport);

                console.log(PGNM, buffer.toString('binary', ret.offset, ret.offset + ret.info.length));
            } else
                console.log(PGNM, 'Unsupported IPv4 protocol: ' + PROTOCOL.IP[ret.info.protocol]);
        } else
            console.log(PGNM, 'Unsupported Ethertype: ' + PROTOCOL.ETHERNET[ret.info.type]);

    });

    parser.on('end', endprog);

    async function insert_data(datas) {
        if (args.norcv == 'X')
            await write_rec(datas);
        else {
            let serr = '';
            await con.query("INSERT INTO TLOADDATA \
                (TCODE, O_STIME,STIME,RTIME, SRCIP,SRCPORT,DSTIP,DSTPORT,PROTO, URI,SEQNO,ACKNO,slen,rlen,SDATA,RDATA) \
                values \
                ( ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?) ",
                [args.tcode, datas.o_stime, datas.stime, datas.rtime, datas.srcip, datas.srcport, datas.dstip, datas.dstport, '0',
                    datas.uri, datas.seqno, datas.ackno, datas.slen,
                    datas.rdata.length, datas.sdata, datas.rdata])
                .then(dt => {
                    icnt += 1;
                    workTime = new Date();
                    if (icnt % 5000 == 0) {
                        console.log(PGNM + "** insert ok %s", icnt.toLocaleString().padStart(7));
                    }
                })
                .catch(err => {
                    console.error(" insert error size(%d) count(%d) %s", datas.rdata.length + datas.sdata.length, icnt, dstv, workTime.toString());
                    console.error(err);
                    process.emit('SIGINT');
                });
        }
    }

    function write_rec(datas) {
        return new Promise(function (resolve, reject) {
            if (datas.slen > datas.sdata.length) reject();
            let pos = datas.sdata.indexOf(0x00);
            if (pos == -1) pos = datas.sdata.length;
            let rec = "~AQTD~" + datas.uri.padEnd(32, ' ') + datas.stime.padEnd(26, ' ') + datas.srcip.padEnd(15, ' ') + util.format('%d', datas.srcport).padStart(5, '0')
                + datas.dstip.padEnd(15, ' ') + util.format('%d', datas.dstport).padStart(5, '0') + util.format('%d', datas.seqno).padStart(15, '0')
                + util.format('%d', datas.ackno).padStart(15, '0') + util.format('%d', datas.slen).padStart(8, '0');
            let brec = Buffer.concat([Buffer.from(rec), datas.sdata.slice(0, pos)]);
            process.stdout.write(brec);
            resolve(icnt++);
        });
    }

    async function endprog() {
        let tcnt = myMap.size;

        console.log(PGNM, "endprog:", tcnt);
        for (let datas of myMap.values()) {
            await insert_data(datas);
            myMap.delete(ky);
        }
        myMap.clear();
        if (args.jobId) {
            await con.query("UPDATE texecjob set resultstat = 2, msg = concat(msg,now(),':',?,'\r\n' ), endDt = now() where pkey = ? ",
                [icnt + " 건 Import", args.jobId]);
        }
        await con.end();

        if (args.norcv == 'X')
            process.stdout.write("^AQTEND^");
        else {
            console.log("%s *** Import completed (%d) ***", PGNM, icnt);
            console.log("%s *******>> end Job <<******\n", PGNM);
        }
        process.exit(0);
    }

}
