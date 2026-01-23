// 신한 IC
const Net = require('net');
const moment = require('moment');

const port = process.argv[2] ?? 12617;

const server = new Net.Server();
const cdate = () => moment().format("MM/DD HH:mm:ss.SSS]");
const mylog = console.log ;
server.listen(port,"0.0.0.0" ,function () {
    mylog(cdate(), `shinhan IC listening for connection requests on socket  port: ${port}`);
});

// When a client requests a connection with the server, the server creates a new
// socket dedicated to that client.
server.on('connection', function (socket) {
    mylog(cdate(), 'A new connection has been established.');
    const rval = Buffer.concat([Buffer.from(' '.repeat(6)), Buffer.from('FFFB19FFFD19', 'hex')]);
    socket.write(rval);
    console.log(cdate(), rval.toString('hex'));
    let cok = 0;
    let sv_chunk = Buffer.from('');
    socket.on('data', function (chunk) {
        //      console.log(cdate(),chunk.toString('hex')) ;
        sv_chunk = Buffer.concat([sv_chunk, chunk]);
        let lpos = sv_chunk.indexOf('FFEF', 'hex');
        while (lpos > 0) {
            let lchunk = Buffer.from(sv_chunk.slice(0, lpos + 2));
            datacheck(lchunk);
            sv_chunk = sv_chunk.slice(lpos + 2);
            lpos = sv_chunk.indexOf('FFEF', 'hex');
            if (lpos > 0 && lpos < 4) {
                sv_chunk = Buffer.from('');
                break;
            }
        }

    });

    // When the client requests to end the TCP connection with the server, the server
    // ends the connection.
    socket.on('end', function () {
        mylog(cdate(), 'Closing connection with the client');
    });

    // Don't forget to catch error, for your own sake.
    socket.on('error', function (err) {
        mylog(cdate(), `Error: ${err}`);
    });

    function datacheck(chunk) {
        if (chunk.slice(0, 11).toString() == 'ISO02340005') {
            let pff = chunk.indexOf(Buffer.from('ffff', 'hex'));
            while (pff > 0) {
                chunk = Buffer.concat([chunk.slice(0, pff), chunk.slice(pff + 1)]);
                pff = chunk.indexOf(Buffer.from('ffff', 'hex'));
            }

            new dataProc(socket, chunk);
        } else if (cok == 1 && chunk.slice(0, 4).toString() == '0800') {
            chunk.write('0810', 0, 4);
            chunk.write('00', 52, 2);
            socket.write(chunk);
        } else if (cok != 1) {
            const sval = chunk.slice(0, 3).toString('hex').toLocaleUpperCase();
            if (sval == 'FFFD19') {
                console.log(cdate(), 'OK!!');
                cok = 1;
            }
        }

    }

    // The server can also receive data from the client by reading from its socket.
});

function dataProc(sock, chunk) {
    this.socket = sock;
    let dat = Buffer.from(chunk);
    let trgb = dat.slice(12, 14).toString('hex');

    mylog(cdate(),port, chunk.length, trgb);

    if (trgb == '0800') trgb = '0810';
    else if (trgb == '0100') trgb = '0110';
    else if (trgb == '0120') trgb = '0130';
    else if (trgb == '0400') trgb = '0410';
    else {
        console.error("Message Type error:", trgb)
        return;
    }

    let pos = 30;
    let bitmap = ('0'.repeat(32) + parseInt(dat.slice(14, 18).toString('hex'), 16).toString(2)).slice(-33)
        + ('0'.repeat(32) + parseInt(dat.slice(18, 22).toString('hex'), 16).toString(2)).slice(-32)
        + ('0'.repeat(32) + parseInt(dat.slice(22, 26).toString('hex'), 16).toString(2)).slice(-32)
        + ('0'.repeat(32) + parseInt(dat.slice(26, 30).toString('hex'), 16).toString(2)).slice(-32);
    if (bitmap[65] == '1') {
        bitmap += ('0'.repeat(32) + parseInt(dat.slice(30, 34).toString('hex'), 16).toString(2)).slice(-32)
            + ('0'.repeat(32) + parseInt(dat.slice(34, 38).toString('hex'), 16).toString(2)).slice(-32);
        pos = 38;
    }

    //console.log(cdate(),new Date(), 'shinhan bitmap:',  bitmap.length - 1, bitmap.slice(1) );
    
//  print_bitmap(bitmap.slice(1));
    bitmap = Buffer.from(bitmap);

    let rdat = Buffer.from('');

    for (let i = 2; i < bitmap.length; i++) {
        if (i == 65) continue;
        if (bitmap[i] == 48) {   // '0' check
            if (trgb !== '0810') {
                if (i == 39) {
                    rdat = Buffer.concat([rdat, Buffer.from('00')]);
                    bitmap.write('1', 39);
                } else if (i == 44) {
                    const imsi = Buffer.from('0'.repeat(17))
                    imsi.writeInt8(16);
                    rdat = Buffer.concat([rdat, imsi]);
                    bitmap.write('1', 44);
                    // } else if (trgb !== '0110' && i == 140) {
                    //     const imsi = Buffer.from('0'.repeat(11))
                    //     imsi.writeInt8(10) ;
                    //  rdat = Buffer.concat([rdat, imsi]);
                    //  bitmap.write('1', 140);
                }
            }

            if (trgb === '0210') {
                if (i == 47) {
                    rdat = Buffer.concat([rdat, Buffer.from('006090000')]);
                    bitmap.write('1', 47);
                }
            }
            continue;
        }

        //    console.log(cdate(),i,pos,trlayout[i]) ;
        if (trlayout[i] == undefined) {
            console.error(cdate(), "undefined:", i, dat.slice(pos));
            break;
        }
        let len = 0;
        if (trlayout[i].fv === 'v') {
            len = dat.readUInt8(pos);
            if (trlayout[i].t == 'b') len = Math.ceil(len / 2);
            if (!trlayout[i].incl) len++;
        } else if (trlayout[i].fv === 'f') {
            len = trlayout[i].l;
        } else {
            console.error(cdate(), "FV UNDEFINE", i);
            break;
        }

        let imdt = dat.slice(pos, pos + len);
        // console.log(cdate(),i,"pos:",pos, "len:", len, imdt.toString('hex'),imdt.toString());
        pos += len;
        if (i == 18 || i == 19 || i == 35 || i == 52 || i == 55 || i == 60 || i == 90 || (i > 125 && i !== 137)) {
            bitmap.write('0', i);
            continue;
        }

        if (trgb == '0430') {
            if (i == 12 || i == 13 || i == 32 || i == 56) {
                bitmap.write('0', i);
                continue;
            }
        }
        if (trgb == '0230') {
            if (i == 12 || i == 13 || i == 48 || i == 56 || i == 63) {
                bitmap.write('0', i);
                continue;
            }
        }

        if (i === 39) {
            imdt = Buffer.from('00');
        } else if (i == 118) {
            const sno = Date.now().toString().slice(-8);
            imdt.write(sno, 5, 8);
        }

        rdat = Buffer.concat([rdat, imdt]);

    }
    //  const bitmapN = (parseInt(bitmap.slice(1),2).toString(16)).toUpperCase() ;
    let bitmapN = '';
    for (let pi = 1; pi + 8 <= bitmap.length; pi += 8) {
        bitmapN += ('0' + (parseInt(bitmap.slice(pi, pi + 8), 2).toString(16)).toUpperCase()).slice(-2);
        //      console.log( pi.toString().padStart(3,'0'), bitmapN) ;
    }
    let pff = rdat.indexOf(0xff);
    while (pff > 0) {
        rdat = Buffer.concat([rdat.slice(0, pff), Buffer.from('ff', 'hex'), rdat.slice(pff)]);
        pff = rdat.indexOf(0xff, pff + 2);
    }

    rdat = Buffer.concat([dat.slice(0, 12), Buffer.from(trgb + bitmapN, 'hex'), rdat, Buffer.from('FFEF', 'hex')]);
    console.log(cdate(), "return bitmap:", bitmapN.length, bitmapN);
    // print_bitmap(bitmap.slice(1).toString());

    this.socket.write(rdat);
    mylog(cdate(),"last len:", rdat.length);
}

function print_bitmap(bm) {
    const bma = bm.split('');
    console.log(cdate(), "<<bit map>>");
    for (let i = 0; i < bma.length; i++) {
        process.stdout.write((i + 1) + ":" + bma[i] + ",");
    }
    console.log(cdate(), '');
}
function solution(num) {
    let answer = "";
    const dfs = (level) => {
        if (level === 0) return;
        else {
            dfs(Math.floor(level / 2));
            answer += level % 2;
        }
    };
    dfs(num);

    return ('0'.repeat(32) + answer).slice(-32);
}


const trlayout = {
    2: { "l": 11, "t": "b", "fv": "v" },
    3: { "l": 3, "t": "b", "fv": "f" },
    4: { "l": 6, "t": "b", "fv": "f" },
    7: { "l": 5, "t": "b", "fv": "f" },
    11: { "l": 3, "t": "b", "fv": "f" },
    14: { "l": 2, "t": "b", "fv": "f" },
    18: { "l": 2, "t": "b", "fv": "f" },
    19: { "l": 2, "t": "b", "fv": "f" },
    22: { "l": 2, "t": "b", "fv": "f" },
    23: { "l": 2, "t": "b", "fv": "f" },
    25: { "l": 1, "t": "b", "fv": "f" },
    32: { "l": 7, "t": "b", "fv": "v" },
    35: { "l": 20, "t": "b", "fv": "v" },
    37: { "l": 12, "t": "a", "fv": "f" },
    39: { "l": 2, "t": "a", "fv": "f" },
    42: { "l": 15, "t": "a", "fv": "f" },
    44: { "l": 26, "t": "a", "fv": "v" },
    49: { "l": 2, "t": "b", "fv": "f" },
    52: { "l": 8, "t": "b", "fv": "f" },
    55: { "l": 256, "t": "a", "fv": "v" }, // bad layout
    60: { "l": 60, "t": "a", "fv": "v" }, // bad layout
    70: { "l": 2, "t": "b", "fv": "f" },
    90: { "l": 21, "t": "b", "fv": "f" },
    118: { "l": 256, "t": "a", "fv": "v" },
    119: { "l": 256, "t": "a", "fv": "v" },
    120: { "l": 256, "t": "a", "fv": "v" },
    126: { "l": 256, "t": "a", "fv": "v" },
    130: { "l": 3, "t": "a", "fv": "f" },
    131: { "l": 5, "t": "a", "fv": "f" },
    132: { "l": 4, "t": "a", "fv": "f" },
    134: { "l": 16, "t": "a", "fv": "v", "incl": 1 },
    136: { "l": 16, "t": "a", "fv": "f" },
    137: { "l": 2, "t": "a", "fv": "f" },
    138: { "l": 2, "t": "a", "fv": "f" },
    140: { "l": 16, "t": "a", "fv": "v" },
    143: { "l": 20, "t": "a", "fv": "v" },
    144: { "l": 1, "t": "b", "fv": "f" },
    145: { "l": 2, "t": "b", "fv": "f" },
    146: { "l": 3, "t": "b", "fv": "f" },
    147: { "l": 6, "t": "b", "fv": "f" },
    148: { "l": 2, "t": "b", "fv": "f" },
    149: { "l": 6, "t": "b", "fv": "f" }
}
