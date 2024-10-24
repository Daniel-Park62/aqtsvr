const Net = require('net');
const moment = require('moment');

const port = process.argv[2] ?? 10613;

const server = new Net.Server();
const mylog = console.log ;
const cdate = () => moment().format("MM/DD HH:mm:ss.SSS]");
server.listen(port, "0.0.0.0", function () {
    mylog(cdate(), `hana listening for connection requests on socket  port: ${port}`);
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
        //      console.log(cdate(),chunk.toString()) ;
        if (chunk.length <= 0) {
            console.log(cdate(), "Date 0 byte Error");
        } else {
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
        if (chunk.slice(0, 10).toString() == 'ISO0234000') {
            let pff = chunk.indexOf(Buffer.from('ffff', 'hex'));
            while (pff > 0) {
                chunk = Buffer.concat([chunk.slice(0, pff), chunk.slice(pff + 1)]);
                pff = chunk.indexOf(Buffer.from('ffff', 'hex'));
            }
            console.time('checktime');
            new dataProc(socket, chunk);
            console.timeEnd('checktime');
        } else if (cok != 1) {
            const sval = chunk.slice(0, 3).toString('hex').toLocaleUpperCase();
            if (sval == 'FFFD19') {
                cok = 1;
            }
        }

    }
    // The server can also receive data from the client by reading from its socket.
});


function dataProc(sock, chunk) {
    this.socket = sock;
    const dat = Buffer.from(chunk);

    let trgb = dat.slice(12, 14).toString('hex');
    mylog(cdate(),port, chunk.length, trgb);

    if (trgb == '0800') trgb = '0810';
    else if (trgb == '0200') trgb = '0210';
    else if (trgb == '0400') trgb = '0410';
    else if (trgb == '0600') trgb = '0610';
    else if (trgb == '0220') trgb = '0230';
    else {
        console.error("Message Type error:", trgb)
        return;
    }

    let pos = 22;
    let bitmap = ('0'.repeat(32) + parseInt(dat.slice(14, 18).toString('hex'), 16).toString(2)).slice(-33)
        + ('0'.repeat(32) + parseInt(dat.slice(18, 22).toString('hex'), 16).toString(2)).slice(-32);
    if (bitmap[1] == '1') {
        bitmap += ('0'.repeat(32) + parseInt(dat.slice(22, 26).toString('hex'), 16).toString(2)).slice(-32)
            + ('0'.repeat(32) + parseInt(dat.slice(26, 30).toString('hex'), 16).toString(2)).slice(-32);
        pos = 30;
    }
    //print_bitmap(bitmap.slice(1)) ;
    //console.log(cdate(),new Date(), 'hana bitmap:',  bitmap.length - 1, bitmap.slice(1) );
    // console.log('1234567890'.repeat(13));
    // console.log(bitmap.slice(1));
    bitmap = Buffer.from(bitmap);

    let rdat = Buffer.from('');
    let trgb6 = '';
    for (let i = 2; i < bitmap.length; i++) {
        if (bitmap[i] == 48) {
            if (i == 39) {
                rdat = Buffer.concat([rdat, Buffer.from('00')]);
                bitmap.write('1', i);
            } if (trgb == '0210' && (i == 9 || i == 10)) {
                rdat = Buffer.concat([rdat, Buffer.from('00000000', 'hex')]);
                bitmap.write('1', i);
            }
            continue;
        }
        //    console.log(cdate(),i,pos,trlayout[i]) ;
        if (trlayout[i] == undefined) {
            console.error(cdate(), "undefined:", i, dat.slice(pos));
            break;
        }
        let len = 0;
        if (i == 35) console.log(i, trlayout[i]);
        if (trlayout[i].fv == 'v') {
            len = dat.readUInt8(pos);
            if (trlayout[i].t == 'b') len = Math.ceil(len / 2);
            //console.log(i, len, trlayout[i]) ;
            if (len > trlayout[i].l) {
                console.error('over length:', len, trlayout[i].l);
                len = trlayout[i].l;
            }
            if (!trlayout[i].incl) len++;

        } else if (trlayout[i].fv === 'f') {
            len = trlayout[i].l;
        } else {
            console.error(cdate(), "FV UNDEFINE", i);
            break;
        }
        let imdt = dat.slice(pos, pos + len);
        //console.log(cdate(),i,"pos:",pos, "len:", len, imdt.toString('hex'));
        pos += len;
        if (trgb == '0210') {
            if (i == 47 || i == 48 || i == 52 || i == 60 || i == 90 || i == 119 || i == 120 || i == 126) {
                bitmap.write('0', i);
                continue;
            }
        }
        if (trgb == '0230') {
            if (i == 25 || i == 32 || i == 47 || i == 60 || i == 119) {
                bitmap.write('0', i);
                continue;
            }
        }
        if (trgb == '0410') {
            if (i == 25 || i == 60 || i == 90 || i == 119) {
                bitmap.write('0', i);
                continue;
            }
        }
        if (i == 3) trgb6 = imdt.toString('hex');
        else if (i == 39) {
            imdt = Buffer.from('00');
        } else if (i == 118 && trgb6 !== '000020') {
            const sno = Date.now().toString().slice(-8);
            imdt.write(sno, 4, 8);
        }

        rdat = Buffer.concat([rdat, imdt]);

    }

    //  const bitmapN = (parseInt(bitmap.slice(1),2).toString(16)).toUpperCase() ;
    let bitmapN = '';
    for (let pi = 1; pi + 8 <= bitmap.length; pi += 8) {
        bitmapN += ('0' + (parseInt(bitmap.slice(pi, pi + 8), 2).toString(16)).toUpperCase()).slice(-2);
    }
    let pff = rdat.indexOf(0xff);
    while (pff > 0) {
        rdat = Buffer.concat([rdat.slice(0, pff), Buffer.from('ff', 'hex'), rdat.slice(pff)]);
        pff = rdat.indexOf(0xff, pff + 2);
    }

    rdat = Buffer.concat([dat.slice(0, 12), Buffer.from(trgb + bitmapN, 'hex'), rdat, Buffer.from('FFEF', 'hex')]);
    this.socket.write(rdat);
    console.log(cdate(), "return bitmap:", bitmapN.length, bitmapN);
    // print_bitmap(bitmap.slice(1).toString()) ;
    mylog(cdate(), "last len:", rdat.length);
}

function print_bitmap(bm) {
    const bma = bm.split('');
    console.log(cdate(), "<<bit map");
    for (let i = 0; i < bma.length; i++) {
        process.stdout.write((i + 1) + ":" + bma[i] + " ");
    }
    console.log("");
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
    2: { "l": 10, "t": "b", "fv": "v", "vl": 1 },
    3: { "l": 3, "t": "b", "fv": "f" },
    4: { "l": 6, "t": "b", "fv": "f" },
    7: { "l": 5, "t": "b", "fv": "f" },
    9: { "l": 4, "t": "b", "fv": "f" },
    10: { "l": 4, "t": "b", "fv": "f" },
    11: { "l": 3, "t": "b", "fv": "f" },
    22: { "l": 2, "t": "b", "fv": "f" },
    23: { "l": 2, "t": "b", "fv": "f" },
    25: { "l": 1, "t": "b", "fv": "f" },
    32: { "l": 3, "t": "b", "fv": "v", "vl": 1 },
    35: { "l": 19, "t": "b", "fv": "v", "vl": 1 },
    37: { "l": 12, "t": "a", "fv": "f" },
    39: { "l": 2, "t": "a", "fv": "f" },
    42: { "l": 15, "t": "a", "fv": "f" },
    47: { "l": 74, "t": "a", "fv": "v", "vl": 1 },
    48: { "l": 126, "t": "a", "fv": "v", "vl": 1 },
    49: { "l": 2, "t": "b", "fv": "f" },
    52: { "l": 16, "t": "b", "fv": "f" },
    55: { "l": 256, "t": "a", "fv": "v", "vl": 1 },
    60: { "l": 47, "t": "b", "fv": "f" },  // layout과 다름
    70: { "l": 2, "t": "b", "fv": "f" },
    90: { "l": 21, "t": "b", "fv": "f" },
    118: { "l": 98, "t": "a", "fv": "f", "vl": 1 },
    119: { "l": 100, "t": "a", "fv": "v", "vl": 1 },
    120: { "l": 150, "t": "a", "fv": "v", "vl": 1 },
    123: { "l": 512, "t": "a", "fv": "f" },
    124: { "l": 512, "t": "a", "fv": "f" },
    126: { "l": 80, "t": "a", "fv": "v", "vl": 1 }
};
const lay55 = [
    [1, 11],
    [2, 4],
    [2, 21],
    [2, 7],
    [2, 5],
    [1, 7],
    [1, 5],
    [1, 3],
    [2, 9],
    [1, 5],
    [2, 4],
    [2, 5],
    [2, 5],
]