const Net = require('net');
const moment = require('moment');

const port = process.argv[2] ?? 11108;

const server = new Net.Server();
const cdate =  () => moment().format("MM/DD HH:mm:ss.SSS]");
server.listen(port, function () {
    console.log(cdate(),`shinhan listening for connection requests on socket  port: ${port}`);
});

// When a client requests a connection with the server, the server creates a new
// socket dedicated to that client.
server.on('connection', function (socket) {
    console.log(cdate(),'A new connection has been established.');
    const rval = Buffer.concat([Buffer.from(' '.repeat(6)), Buffer.from('FFFB19FFFD19', 'hex')]);
    let cok = 0;
    socket.write(rval);
    console.log(cdate(),rval.toString('hex'));

    socket.on('data', function (chunk) {
        console.log(cdate(),chunk.toString()) ;
        if (chunk.slice(0, 11).toString() == 'ISO02340005') {
            let pff = chunk.indexOf(Buffer.from('ffff','hex')) ;
            while (pff > 0 ) {
                chunk = Buffer.concat([chunk.slice(0,pff), chunk.slice(pff+1)]) ;
                pff = chunk.indexOf(Buffer.from('ffff','hex')) ;
            }

            dataProc(socket, chunk);
        } else if (cok == 1 && chunk.slice(0, 4).toString() == '0800') {
            chunk.write('0810', 0, 4);
            chunk.write('00', 52, 2);
            socket.write(chunk);
        } else if (cok != 1) {
            const sval = chunk.slice(0, 3).toString('hex').toLocaleUpperCase();
            if (sval == 'FFFD19') {
                console.log(cdate(),'OK!!') ;
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

    let trgb = dat.slice(12, 16).toString();
    if (trgb == '0800') {
        trgb = '0810';
        dat.write('0810', 12, 4);
        this.socket.write(dat);
        return ;
    }
    else if (trgb == '0200') trgb = '0210';
    else if (trgb == '0420') trgb = '0430';
    else if (trgb == '0220') trgb = '0230';
    else {
        console.error("Message Type error:", trgb)
        return;
    }

    let bitmap = ('0'.repeat(32) + parseInt(dat.slice(16, 24), 16).toString(2)).slice(-33)
                 + ('0'.repeat(32) + parseInt(dat.slice(24, 32), 16).toString(2)).slice(-32);

    let pos = 32;
    if (bitmap[1] == '1') {
        bitmap += ('0'.repeat(32) + parseInt(dat.slice(32, 40), 16).toString(2)).slice(-32)
                + ('0'.repeat(32) + parseInt(dat.slice(40, 48), 16).toString(2)).slice(-32) ;
        pos = 48;
    }

    //console.log(cdate(),new Date(), 'shinhan bitmap:',  bitmap.length - 1, bitmap.slice(1) );
    console.log("trgb",trgb) ;

    print_bitmap(bitmap.slice(1)) ;
    bitmap = Buffer.from(bitmap);
    
    let rdat = Buffer.from('');
    let trgbcd = '000000';
    for (let i = 2 ; i < bitmap.length; i++) {
        if (bitmap[i] == 48) {   // '0' check
            if (trgb !== '0810') {
                if ( i == 39) {
                    rdat = Buffer.concat([rdat, Buffer.from('00')]);
                    bitmap.write('1', 39);
                }
                if (i == 44) {
                    rdat = Buffer.concat([rdat, Buffer.from('000000')]);
                    bitmap.write('1', 44);
                }
                if (i == 56) {
                    if (trgbcd !== '750031') {
                        const sno = Date.now().toString().slice(-8);
                        rdat = Buffer.concat([rdat, Buffer.from('008' + sno)]);
                        bitmap.write('1', 56);
                    }
                }
            }

            // if (trgb === '0210') {
            //  if ( i == 47) {
            //      rdat = Buffer.concat([rdat, Buffer.from('006090000')]);
            //      bitmap.write('1', 47);
            //  }
            // }
            continue ;
        }

        //    console.log(cdate(),i,pos,trlayout[i]) ;
        if (trlayout[i] == undefined) {
            console.error(cdate(),"undefined:", i, dat.slice(pos));
            break;
        }
        let len = 0;
        if (trlayout[i].fv === 'v') {

            if (trlayout[i].vl > 1) {
                len = parseInt(dat.slice(pos, pos + trlayout[i].vl).toString()) ;
                if (! trlayout[i].incl ) len += trlayout[i].vl ;
            } else {
                len = dat.readUInt8(pos);
                if (trlayout[i].t == 'b') len = Math.ceil(len / 2);
                if (! trlayout[i].incl ) len++ ;
            }
        } else if (trlayout[i].fv === 'f') {
            len = trlayout[i].l;
        } else {
            console.error(cdate(),"FV UNDEFINE", i);
            break;
        }

        let imdt = dat.slice(pos, pos + len);

//      console.log(cdate(),i,"pos:",pos, "len:", len, imdt.toString());
        pos += len;
        if (i == 48 || i == 60 || i == 22 ) {  // 22 번 m인데 제외해봄 
            bitmap.write('0', i);
            continue;
        }
        if (i == 3) trgbcd = imdt;

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

        if (trgb !== '0810') {
            if (i === 39) {
                imdt = Buffer.from('00');
            } else if (i == 56) {
                if (trgbcd !== '750031') {
                    const sno = Date.now().toString().slice(-8);
                    imdt.write(sno, 3, 8);
                }
            }
        }

        rdat = Buffer.concat([rdat, imdt]);

    }
//  const bitmapN = (parseInt(bitmap.slice(1),2).toString(16)).toUpperCase() ;
    let bitmapN = '';
    for (let pi=1; pi+8 <= bitmap.length ; pi+=8 ) {
        bitmapN += ('0'+ (parseInt(bitmap.slice(pi,pi+8),2).toString(16)).toUpperCase()).slice(-2) ;
//              console.log( pi.toString().padStart(3,'0'), bitmapN) ;
    }
    let pff = rdat.indexOf(0xff) ;
    while (pff > 0 ) {
        rdat = Buffer.concat([rdat.slice(0,pff), Buffer.from('ff','hex'), rdat.slice(pff)]) ;
        pff = rdat.indexOf(0xff, pff+2) ;
    } 

    rdat = Buffer.concat([dat.slice(0, 12), Buffer.from(trgb + bitmapN), rdat,  Buffer.from('FFEF','hex')]);
    console.log(cdate(), "return bitmap:", bitmapN.length , bitmapN );
//  print_bitmap(bitmap.slice(1).toString());
    this.socket.write(rdat);
    console.log(cdate(),"last len:", rdat.length, rdat.toString() );
}

function print_bitmap(bm) {
    const bma = bm.split('') ;
    console.log(cdate(),"<<bit map>>") ;
    for (let i = 0; i < bma.length ; i++) {
        process.stdout.write((i+1) +":"+bma[i] + ",") ;
    }
    console.log(cdate(),'');
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
    11: { "l": 6, "t": "a", "fv": "f" },
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
    48: { "l": 19, "t": "a", "fv": "v", "vl": 3 },
    49: { "l": 3, "t": "a", "fv": "f" },
    52: { "l": 16, "t": "a", "fv": "f" },
    55: { "l": 5, "t": "a", "fv": "v", "vl": 3 },
    56: { "l": 11, "t": "a", "fv": "v", "vl": 3 },
    60: { "l": 35, "t": "a", "fv": "v", "vl": 3 },
    61: { "l": 83, "t": "a", "fv": "v", "vl": 3 },
    63: { "l": 60, "t": "a", "fv": "v", "vl": 3 },
    70: { "l": 3, "t": "a", "fv": "f" },
    126: { "l": 83, "t": "a", "fv": "v", "vl": 3 },
    127: { "l": 50, "t": "a", "fv": "v", "vl": 3 }
}