//신한가상키
const Net = require('net');
const moment = require('moment');

const port = process.argv[2] ?? 12626;

const server = new Net.Server();
const cdate = () => moment().format("MM/DD HH:mm:ss.SSS]");
const mylog = console.log ;
server.listen(port,"0.0.0.0" , function () {
    mylog(cdate(), `shinhan listening for connection requests on socket  port: ${port}`);
});

// When a client requests a connection with the server, the server creates a new
// socket dedicated to that client.
server.on('connection', function (socket) {
    mylog(cdate(), 'A new connection has been established.');
    const rval = Buffer.concat([Buffer.from(' '.repeat(6)), Buffer.from('FFFB19FFFD19', 'hex')]);
    let cok = 0;
    socket.write(rval);
    console.log(cdate(), rval.toString('hex'));
    let sv_chunk = Buffer.from('');
    socket.on('data', function (chunk) {
        // console.log(cdate(), chunk.toString('hex'));
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
        if (cok == 1 && chunk.slice(0, 11).toString() == 'ISO02340005') {
            if (chunk.slice(12, 16).toString() == '0800') {
                chunk.write('0810', 12, 4);
                socket.write(chunk);
            } else {
                let pff = chunk.indexOf(Buffer.from('ffff','hex')) ;
                while (pff > 0 ) {
                    chunk = Buffer.concat([chunk.slice(0,pff), chunk.slice(pff+1)]) ;
                }
                new dataProc(socket, chunk);
            }
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
    let dat = Buffer.from(chunk) ;
    let trgb = dat.slice(12, 16).toString();
    mylog(cdate(),port, chunk.length, trgb);
    if (trgb == '0200') trgb = '0210';
    else if (trgb == '0800') trgb = '0810';
    else {
        console.error("Message Type error:", trgb);
        this.socket.write(dat);
        return;
    }

    let bitmap = ('0'.repeat(32) + parseInt(dat.slice(16, 24), 16).toString(2)).slice(-33)
        + ('0'.repeat(32) + parseInt(dat.slice(24, 32), 16).toString(2)).slice(-32);

    let pos = 32;

    //console.log(cdate(),new Date(), 'shinhan bitmap:',  bitmap.length - 1, bitmap.slice(1) );
    
//  print_bitmap(bitmap.slice(1));
    bitmap = Buffer.from(bitmap);

    let rdat = Buffer.from('');
    for (let i = 2; i < bitmap.length; i++) {
        if (bitmap[i] == 48) {   // '0' check
            if (trgb !== '0810') {
                if (i == 39) {
                    rdat = Buffer.concat([rdat, Buffer.from('00')]);
                    bitmap.write('1', i);
                } else if (i == 44) {
                    rdat = Buffer.concat([rdat, Buffer.from('04    ')]);
                    bitmap.write('1', 44);
                } else if (i == 47) {
                    rdat = Buffer.concat([rdat, Buffer.from('00601    ')]);
                    bitmap.write('1', 47);
                } else if (i == 56) {
                    const sno = Date.now().toString().slice(-8);
                    rdat = Buffer.concat([rdat, Buffer.from('008' + sno)]);
                    bitmap.write('1', 56);
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
            if (trlayout[i].vl > 0) {
                len = parseInt(dat.slice(pos, pos + trlayout[i].vl).toString());
                len += trlayout[i].vl;
            } else {
                len = trlayout[i].l;
            }
        } else if (trlayout[i].fv === 'f') {
            len = trlayout[i].l;
        } else {
            console.error(cdate(), "FV UNDEFINE", i);
            break;
        }
        // console.log(cdate(),i,"pos:",pos, "len:", len, dat.slice(pos,pos+20).toString('hex'));
        let imdt = dat.slice(pos, pos + len);
        pos += len;
        if (i == 22 || i == 48 || i == 52 || i == 60) {
            bitmap.write('0', i);
            continue;
        }
        if (i == 56) {
            const sno = Date.now().toString().slice(-8);
            imdt.write(sno, 3);
        }
        rdat = Buffer.concat([rdat, imdt]);

    }
//  const bitmapN = (parseInt(bitmap.slice(1), 2).toString(16)).toUpperCase();
    let bitmapN = '';
    for (let pi=1; pi+8 <= bitmap.length ; pi+=8 ) {
        bitmapN += ('0'+ (parseInt(bitmap.slice(pi,pi+8),2).toString(16)).toUpperCase()).slice(-2) ;
    }
    let pff = rdat.indexOf(0xff) ;
    while (pff > 0 ) {
        rdat = Buffer.concat([rdat.slice(0,pff), Buffer.from('ff','hex'), rdat.slice(pff)]) ;
        pff = rdat.indexOf(0xff, pff+2) ;
    } 

    rdat = Buffer.concat([dat.slice(0, 12), Buffer.from(trgb + bitmapN), rdat, Buffer.from('FFEF', 'hex')]);
    this.socket.write(rdat);
    mylog(cdate(), "last len:", rdat.length);
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
    3: { "l": 6, "t": "a", "fv": "f" },
    4: { "l": 12, "t": "a", "fv": "f" },
    7: { "l": 10, "t": "a", "fv": "f" },
    12: { "l": 6, "t": "a", "fv": "f" },
    13: { "l": 4, "t": "a", "fv": "f" },
    22: { "l": 3, "t": "a", "fv": "f" },
    32: { "l": 8, "t": "a", "fv": "v", "vl": 2 },
    35: { "l": 39, "t": "a", "fv": "v", "vl": 2 },
    37: { "l": 12, "t": "a", "fv": "f" },
    39: { "l": 2, "t": "a", "fv": "f" },
    42: { "l": 15, "t": "a", "fv": "f" },
    43: { "l": 40, "t": "a", "fv": "f" },
    44: { "l": 6, "t": "a", "fv": "v", "vl": 2 },
    46: { "l": 43, "t": "a", "fv": "v", "vl": 3 },
    47: { "l": 9, "t": "a", "fv": "v", "vl": 3 },
    48: { "l": 23, "t": "a", "fv": "v", "vl": 3 },
    49: { "l": 3, "t": "a", "fv": "f" },
    52: { "l": 16, "t": "a", "fv": "f" },
    55: { "l": 5, "t": "a", "fv": "v", "vl": 3 },
    56: { "l": 11, "t": "a", "fv": "v", "vl": 3 },
    60: { "l": 51, "t": "a", "fv": "v", "vl": 3 }
}
