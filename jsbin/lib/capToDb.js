"use strict";
const MAX_RESP_LEN = 1024 * 1024 * 2;
const SIZE_BLOB = 1024 * 1024 * 2;
const PGNM = '[capToDb]';
let myMap = null;
let myMap_s = null;
let con ;
// process.on('SIGTERM', endprog);
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
    myMap = new Map();
    myMap_s = new Map();
    const { spawn } = require('child_process');
    const util = require('util');
    const pcapp = require('./pcap-parser');
    const moment = require('moment');
    const decoders = require('./Decoders');
    const PROTOCOL = decoders.PROTOCOL;
    const fs = require('fs');
    let dstobj;
    let ltype = 1;
    let child = null ;
    icnt = 0;
    console.log("%s Start 테스트id(%s) 입력파일(%s)", PGNM, args.tcode, args.dstv);
    if (args.dstv) {
        if (!fs.statSync(args.dstv).isFile()) throw 'is not File';
        dstobj = args.dstv;
    } else {
        // console.error(err);
        console.log(PGNM, "START tcpdump");
        const NETIP = (args.dstip ? ` && ( net ${args.dstip} ) ` : "");
        child = spawn('tcpdump -s0 -w -  ', [args.devno,'"tcp && tcp[13]&16 != 0 ' , NETIP ,args.otherCond ,'"'], { shell: true });
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
            if (endsw) { endsw = 0;  endprog();}
            return ;
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
            if (ret.info.protocol === PROTOCOL.IP.TCP) {
        
                let datalen = ret.info.totallen - ret.hdrlen;
                // console.log(PGNM,'Decoding TCP ...');
                ret = decoders.TCP(buffer, ret.offset);
//               console.log(PGNM,ret.hdrlen ,srcip, dstip,' from port: ' + ret.info.srcport + ' to port: ' + ret.info.dstport);
                datalen -= ret.hdrlen;
                if (datalen <= 0) return;
                // console.log(PGNM,'seqno ', ret.info.seqno, 'ackno ', ret.info.ackno, 'datalen ', datalen, ' next ', ret.info.seqno + datalen);
                // console.log(PGNM,ret) ;
                // console.log(PGNM,buffer.toString('binary', ret.offset, ret.offset + datalen));
                // console.log(PGNM,buffer.slice(ret.offset, ret.offset + 200).toString());
                let ky = util.format('%s:%d:%d', srcip, ret.info.srcport, Math.floor(ret.info.ackno / 100));
                let sky = util.format('%s:%d:%s:%d', srcip, ret.info.srcport, dstip, ret.info.dstport);
                if (patt1.test(dstip) && patt2.test(ret.info.dstport.toString() ) 
                    && /^(GET|POST|DELETE|PUT|PATCH)\s/.test(buffer.slice(ret.offset, ret.offset + 10).toString())) {
                    // let sdata = buffer.slice(ret.offset, ret.offset + datalen);
                    let sdata = buffer.slice(ret.offset);
                    let mdata = /^(GET|POST|DELETE|PUT|PATCH)\s+(\S+?)[?\s](?:.*Content-Length:\s*(\d+)|.*)?/s.exec(sdata.toString());
                    if (mdata == undefined) {
                        console.error(PGNM, "mdata undefined",sdata.toString());
                        return;
                    }
                    if (/\.(css|js|ico|png|jpg|gif|png|pdf|html)$/i.test(mdata[2])) return;
                    let clen = mdata[3] ? Number(mdata[3]) : 0;
                    let datas = {
                        tcode: args.tcode,
                        method: mdata[1],
                        // uri: decodeURIComponent(mdata[2].replace(/(.+)\/$/,'$1')) ,
                        o_stime: ptime,
                        stime: ptime,
                        rtime: ptime,
                        sdata: sdata,
                        slen: datalen,
                        shlen: clen,
                        rlen: -1,
                        srcip: srcip,
                        dstip: dstip,
                        srcport: ret.info.srcport,
                        dstport: ret.info.dstport,
                        seqno: ret.info.seqno,
                        ackno: ret.info.ackno,
                        rhead: '',
                        rdata: '',
                        rcode: 0,
                        isUTF8: true
                    };
                    try {
                        datas.uri = decodeURIComponent(mdata[2].replace(/(.+)\/$/, '$1'));
                    } catch (error) {
                        console.error(PGNM, mdata[2], error);
                        datas.uri = mdata[2].replace(/(.+)\/$/, '$1');
                    }
                    if (args.norcv && datas.slen <= datas.sdata.length) {
                        await insert_data(datas);
                        return;
                    }
                    clen = 0;
                    ky = util.format('%s:%d:%d', dstip, ret.info.dstport, Math.floor((ret.info.seqno + datalen + clen) / 100));
                    myMap.set(ky, datas);
                    myMap_s.set(sky, ky);
                } else if (args.norcv) {
                    return;
                } else if (myMap.has(ky)) {
                    let datas = myMap.get(ky);
                    // if (/s3021\.jsp/.test(datas.uri))
                    //     console.log(PGNM,datalen, buffer.slice(ret.offset).toString()+":" );
                    if (ptime > datas.stime)
                        datas.rtime = ptime;
                    let pi = buffer.indexOf("\r\n\r\n");
                    let res = '';
                    if (pi == -1) {
                        pi = ret.offset;
                        res = buffer.slice(ret.offset).toString();
                    } else {
                        res = buffer.slice(ret.offset, pi).toString();
                    };
                    if (res.match(/Content-Type:\s*image/)) {
                        myMap.delete(ky);
                        // console.log(PGNM,res) ;
                        return;
                    };
                    if (/^HTTP\/.+/s.test(res)) {
                        datas.rhead = res;
                        datas.isUTF8 = ! /charset=euc-kr/si.test(res);
                    } else
                        pi = ret.offset;
                    let rcode = /^HTTP.+?\s(\d+?)\s(?:.*Content-Length:\s*(\d+)|.*)?/s.exec(res);
                    let rval = {};
                    if (rcode) {
                        // datalen -= res.length ;
                        datas.rcode = Number(rcode[1]);
                        datas.rlen = rcode[2] ? Math.min(Number(rcode[2]), MAX_RESP_LEN) : MAX_RESP_LEN;
                    };
                    // if (datas.seqno == 995092230) console.log("@@" + buffer.slice(pi,pi+100 ).toString());
                    rval = bufTrimN(buffer.slice(pi), datas.isUTF8);
                    if (datas.rdata.length > 0)
                        // datas.rdata = Buffer.concat([datas.rdata, bufTrim(buffer.slice(ret.offset))]);
                        datas.rdata = Buffer.concat([datas.rdata, rval.data]);
                    else
                        // datas.rdata = buffer.slice(ret.offset);
                        datas.rdata = rval.data;
                    // console.log(PGNM,"(1)",buffer.slice(pi, ret.offset).toString().trim() );
                    // console.log(PGNM,"(2)",rval.chk, rval.data.toString() );
                    // if ( datas.seqno == 1202683084) console.log("[%s]", buffer.slice(pi ).toString() );
                    // if (rval.chk || datas.rlen > 0 && (datas.rdata.length >= (MAX_RESP_LEN >= datas.rlen ? MAX_RESP_LEN : datas.rlen))) {
                    if (rval.chk || datas.rlen == 0 || datas.rdata.length >= datas.rlen || ret.info.flags & 0x08) {
                        await insert_data(datas);
                        myMap.delete(ky);
                    } else {
                        myMap.set(ky, datas);
                    }
                } else if (myMap_s.has(sky) && myMap.has(myMap_s.get(sky))) {
                    let datas = myMap.get(myMap_s.get(sky));
                    let pi = datas.sdata.indexOf("\r\n\r\n");
                    if (pi >= 0 && datas.method == 'GET') return;
                    if (pi >= 0 && datas.shlen > 0 && datas.sdata.slice(pi + 4).length >= datas.shlen) return;
                    myMap.delete(myMap_s.get(sky));
                    let ky2 = util.format('%s:%d:%d', dstip, ret.info.dstport, Math.floor((ret.info.seqno + datalen) / 100));
                    datas.sdata = Buffer.concat([datas.sdata, buffer.slice(ret.offset)]);
                    datas.slen = datas.sdata.length;
                    myMap_s.set(sky, ky2)
                    myMap.set(ky2, datas);
                }
            } else if (ret.info.protocol === PROTOCOL.IP.UDP) {
                console.log(PGNM, 'Decoding UDP ...');
                ret = decoders.UDP(buffer, ret.offset);
                console.log(PGNM, ' from port: ' + ret.info.srcport + ' to port: ' + ret.info.dstport);
                console.log(PGNM, buffer.toString('binary', ret.offset, ret.offset + ret.info.length));
            } else
                console.log(PGNM, 'Unsupported IPv4 protocol: ' + PROTOCOL.IP[ret.info.protocol]);
        } else
            console.log(PGNM, 'Unsupported Ethertype: ', ret.info.type, PROTOCOL.ETHERNET[ret.info.type]);
    });
    parser.on('end', endprog );
    const iconv = require('iconv-lite');
    function bufTrimN(buf, isUTF8) {
        // let pi = buf.length > 100 ? 100 : buf.length;
        if (buf.length == 0)
            return { data: buf, chk: false };
        let str = isUTF8 ? buf.toString() : iconv.decode(buf, 'EUC-KR').toString();
        // str = str.trim();
        // let rstr = /^\s*([0-9a-fA-F]+)\r\n\s*/s.exec(str) ;
        // let sz = parseInt( /^\s*([0-9a-fA-F]+)\r\n\s*/s.exec(str) [1], 16) || 0 ;
        let rval = { chk: (/\n0+\r\n\s*$/s.test(str)) };
        // if (rval.chk)
        //     console.log("**", rval.chk ,str.length, str) ;
        //str = str.replace(/\s0\r\n\s*$/s, '');
        str = str.replace(/^(\r\n)?[0-9a-fA-F]{1,4}\r\n/ms, '');
        str = str.trim();
        rval.data = Buffer.from(str);
        return rval;
    }
    async function endprog() {
        let cnt = 0;
        let tcnt = myMap.size;
        if (tcnt) console.log(PGNM,"myMap:", tcnt);
        for (let datas of myMap.values()) {
            // if (datas.rhead.length == 0)  datas.rhead = 'No Data' ;
            if (datas.rhead.length > 0 || datas.rdata.length > 0) {
                // datas.rdata = bufTrim(datas.rdata);
                await insert_data(datas);
            };
            cnt++;
            // myMap.delete(ky);
        }
        myMap.clear();
        if (args.jobId) {
            await con.query("UPDATE texecjob set resultstat = 2, msg = concat(msg,now(),':',?,'\r\n' ), endDt = now() where pkey = ? ",
                [icnt + " 건 Import", args.jobId]);
        }
        console.log("%s *** Import completed (%d 건)***", PGNM, icnt);
        await con.end();
        process.exit();
    }
    async function insert_data(datas) {
        if (args.norcv == 'X') {
            process.stdout.write(datas.sdata);
            return ;
        }
        return con.query("INSERT INTO TLOADDATA \
            (TCODE, O_STIME,STIME,RTIME, SRCIP,SRCPORT,DSTIP,DSTPORT,PROTO, URI,SEQNO,ACKNO \
                ,METHOD,RCODE,RHEAD,slen,rlen,SDATA,RDATA) \
            values \
            ( ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?) ",
            [datas.tcode,  datas.o_stime, datas.stime, datas.rtime, datas.srcip, datas.srcport, datas.dstip, datas.dstport, '1',
            datas.uri, datas.seqno, datas.ackno, datas.method, datas.rcode, datas.rhead, datas.slen,
            datas.rdata.length, datas.sdata, datas.rdata])
            .then(dt => {
                icnt++;
                if (icnt % 1000 == 0) {
                    console.log(PGNM + "** insert ok %s", icnt.toLocaleString().padStart(7));
                }
            })
            .catch(err => {
                console.error(" insert error size(%d) count(%d) ", datas.rdata.length + datas.sdata.length, icnt);
                console.error(err);
                // process.emit('SIGINT');
            });
    }
}