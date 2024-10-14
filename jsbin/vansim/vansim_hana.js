const Net = require('net');
const moment = require('moment');

const port = process.argv[2] ?? 10613;

const server = new Net.Server();
const cdate =  () => moment().format("MM/DD HH:mm:ss.SSS]");
server.listen(port, function () {
    console.log(cdate(),`hana listening for connection requests on socket  port: ${port}`);
});

// When a client requests a connection with the server, the server creates a new
// socket dedicated to that client.
server.on('connection', function (socket) {
    console.log(cdate(),'A new connection has been established.');
    const rval = Buffer.concat([Buffer.from(' '.repeat(6)), Buffer.from('FFFB19FFFD19', 'hex')]);
    socket.write(rval);
    console.log(cdate(),rval.toString('hex'));
    let cok = 0;

    socket.on('data', function (chunk) {
        console.log(cdate(),chunk.toString('hex')) ;
        console.log(cdate(),chunk.toString()) ;
        if ( chunk.slice(0, 10).toString() == 'ISO0234000') {
            let pff = chunk.indexOf(Buffer.from('ffff','hex')) ;
            if (pff > 0 ) {
                chunk = Buffer.concat([chunk.slice(0,pff), chunk.slice(pff+1)]) ;
            }
            dataProc(socket, chunk);
        } else if (cok != 1) {
            const sval = chunk.slice(0, 3).toString('hex').toLocaleUpperCase();
            if (sval == 'FFFD19') {
                cok = 1;
            }
        }

    });

    // When the client requests to end the TCP connection with the server, the server
    // ends the connection.
    socket.on('end', function () {
        console.log(cdate(),'Closing connection with the client');
    });

    // Don't forget to catch error, for your own sake.
    socket.on('error', function (err) {
        console.log(cdate(),`Error: ${err}`);
    });


    // The server can also receive data from the client by reading from its socket.
});

function dataProc(sock, dat) {
    this.socket = sock;
    const header = dat.slice(0, 12);

    let trgb = dat.slice(12, 14).toString('hex');
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
                + ('0'.repeat(32) + parseInt(dat.slice(18, 22).toString('hex'), 16).toString(2)).slice(-32) ;
    if (bitmap[1] == '1') {
        bitmap += ('0'.repeat(32) + parseInt(dat.slice(22, 26).toString('hex'), 16).toString(2)).slice(-32)
                + ('0'.repeat(32) + parseInt(dat.slice(26, 30).toString('hex'), 16).toString(2)).slice(-32) ;
        pos = 30 ;
    }
    console.log("trgb",trgb) ;
    print_bitmap(bitmap.slice(1)) ;
    //console.log(cdate(),new Date(), 'hana bitmap:',  bitmap.length - 1, bitmap.slice(1) );
    bitmap = Buffer.from(bitmap);

    let rdat = Buffer.from('');
    
    for (let i = 2 ; i < bitmap.length; i++) {
        if (bitmap[i] == 48) {
            if ( i == 39) {
                rdat = Buffer.concat([rdat, Buffer.from('00')]);
                bitmap.write('1', i);
            } if ( trgb == '0210' && (i == 9 || i == 10)) {
                rdat = Buffer.concat([rdat, Buffer.from('00000000','hex')]);
                bitmap.write('1', i);
            }
            continue;
        }
        //    console.log(cdate(),i,pos,trlayout[i]) ;
        if (trlayout[i] == undefined) {
            console.error(cdate(),"undefined:", i, dat.slice(pos));
            break;
        }
        let len = 0;
        if (i == 35) console.log(i, trlayout[i]) ;
        if (trlayout[i].fv == 'v') {
            len = dat.readUInt8(pos);
            if (trlayout[i].t == 'b') len = Math.ceil(len / 2);
            console.log(i, len, trlayout[i]) ;
            if (len > trlayout[i].l) {
                console.error('over length:',len, trlayout[i].l);
                len = trlayout[i].l ;
            }
            if (! trlayout[i].incl ) len++ ;

        } else if (trlayout[i].fv === 'f') {
            len = trlayout[i].l;
        } else {
            console.error(cdate(),"FV UNDEFINE", i);
            break;
        }
        let imdt = dat.slice(pos, pos + len);
        // console.log(cdate(),i,"pos:",pos, "len:", len, imdt.toString('hex'),imdt.toString());
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

        if (i == 39) {
            imdt = Buffer.from('00');
        } else if (i == 118) {
            const sno = Date.now().toString().slice(-8) ;   
            imdt.write(sno,4,8) ;
        }

        rdat = Buffer.concat([rdat, imdt]);

    }

//  const bitmapN = (parseInt(bitmap.slice(1),2).toString(16)).toUpperCase() ;
    let bitmapN = '';
    for (let pi=1; pi+8 <= bitmap.length ; pi+=8 ) {
        bitmapN += ('0'+ (parseInt(bitmap.slice(pi,pi+8),2).toString(16)).toUpperCase()).slice(-2) ;
    }
    let pff = rdat.indexOf(0xff) ;
    while (pff > 0 ) {
        rdat = Buffer.concat([rdat.slice(0,pff), Buffer.from('ff','hex'), rdat.slice(pff)]) ;
        pff = rdat.indexOf(0xff, pff+2) ;
    } 

    rdat = Buffer.concat([dat.slice(0, 12), Buffer.from(trgb + bitmapN , 'hex'), rdat, Buffer.from('FFEF','hex')]);
    this.socket.write(rdat);
    console.log(cdate(), "return bitmap:", bitmapN.length , bitmapN );
    // print_bitmap(bitmap.slice(1).toString()) ;
    console.log(cdate(),"last len:", rdat.length);
}

function print_bitmap(bm) {
    const bma = bm.split('') ;
    console.log(cdate(),"<<bit map") ;
    for (let i = 0; i < bma.length ; i++) {
        process.stdout.write((i+1) +":"+bma[i] + " ") ;
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
} ;
const lay55 = [
    [1,11],
    [2,4],
    [2,21],
    [2,7],
    [2,5],
    [1,7],
    [1,5],
    [1,3],
    [2,9],
    [1,5],
    [2,4],
    [2,5],
    [2,5],
]