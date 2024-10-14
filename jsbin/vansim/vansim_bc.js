const Net = require('net');
const moment = require('moment');

const port = process.argv[2] ?? 11108;

const server = new Net.Server();
const cdate =  () => moment().format("MM/DD HH:mm:ss.SSS]");
server.listen(port, function () {
    console.log(cdate(),`BC listening for connection requests on socket  port: ${port}`);
});

// When a client requests a connection with the server, the server creates a new
// socket dedicated to that client.
server.on('connection', function (socket) {
    console.log(cdate(),'A new connection has been established.');
    const rval = Buffer.concat([Buffer.from(' '.repeat(6)), Buffer.from('FFFB19FFFD19', 'hex')]);
    let cok = 0;
    if (port == '11108' ) {
        socket.write(rval);
        console.log(cdate(),rval.toString('hex'));
    } else {
        cok  = 1 ;
    }
    let sv_chunk = Buffer.from('') ;
    socket.on('data', function (chunk) {
        // console.log(cdate(),chunk.toString('hex')) ;
        if (port == '11108' ) {
            sv_chunk = Buffer.concat([sv_chunk, chunk]) ;
            let lpos = sv_chunk.indexOf('FFEF','hex');
            while (lpos >= 0) {
                let lchunk = Buffer.from( sv_chunk.slice(0,lpos+2)) ;
                dataproc(lchunk) ;
                sv_chunk = sv_chunk.slice(lpos+2) ;
                lpos = sv_chunk.indexOf('FFEF','hex');
                if (lpos > 0 && lpos < 4)  {
                    sv_chunk = Buffer.from('') ;
                    break ;
                }
            }

        } else {
            sv_chunk = Buffer.concat([sv_chunk, chunk]) ;
            let lens = Number(sv_chunk.slice(0,4)) ;
            while (lens <=  sv_chunk.length -4 ) {
                let lchunk = Buffer.from(sv_chunk.slice(0, lens+4)) ;
                dataproc(lchunk) ;
                sv_chunk = sv_chunk.slice(lens+4) ;
                lens = Number(sv_chunk.slice(0,4)) ;
                if (lens == NaN) {
                    sv_chunk = Buffer.from('') ;
                    break ;
                }
            }
        }

    });

    function dataproc(chunk) {
        // console.log(cdate(),chunk.toString('hex')) ;
        console.log(cdate(),port, cok, chunk.length ) ;
        if ( port !== '11108' ) {
            lenc = Number(chunk.slice(0,4)) ;
            chunk = chunk.slice(4) ;
            if (chunk.length > lenc ) sv_chunk = Buffer.concat([ sv_chunk , chunk.slice(lenc)]) ;
            
        } 
        if (cok == 1 && chunk.slice(0, 12).toString() == 'ISO023400053') {
            //        console.log(cdate(),chunk.slice(0,12).toString()) ;
            chunk.writeInt16BE(0x0810, 12);
            if (port !== '11108') {
                chunk = Buffer.concat([Buffer.from(chunk.length.toString().padStart(4,'0')), chunk]) ;
            }
            socket.write(chunk);
        } else if (cok == 1 && chunk.slice(0, 4).toString() == '0800') {
            
            chunk.write('0810', 0, 4);
            chunk.write('00', 52, 2);
            if (port !== '11108') {
                chunk = Buffer.concat([Buffer.from(chunk.length.toString().padStart(4,'0')), chunk]) ;
            }
            socket.write(chunk);
//          console.log("0810 return", chunk.toString() ) ;
            cok = 1;
        } else if (cok == 1 && chunk.slice(12, 16).toString() == '0800') {
            chunk.write('0810', 12, 4);
            chunk.write('00', 52, 2);
            if (port !== '11108') {
                chunk = Buffer.concat([Buffer.from(chunk.length.toString().padStart(4,'0')), chunk]) ;
            }
            socket.write(chunk);
            cok = 1;
        } else if (chunk.slice(12, 16).toString() == '6770') {
             new dataProc6770(socket, chunk);
    
        } else if ( chunk.length > 50)
             new dataProcBC(socket, chunk);

        if (cok != 1) {
            const sval = chunk.slice(0, 3).toString('hex').toLocaleUpperCase();
            if (sval == 'FFFD19') {
                cok = 1;
            }
        }

    }
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

function dataProcBC(sock, chunk) {
    this.socket = sock;
    let dat = Buffer.from(chunk) ;
    if ( port == '11108' ) {
        let pff = dat.indexOf(Buffer.from('ffff','hex')) ;
        while (pff > 0 ) {
            dat = Buffer.concat([dat.slice(0,pff), dat.slice(pff+1)]) ;
            pff = dat.indexOf(Buffer.from('ffff','hex')) ;
        }
    }
    let trgb = dat.slice(12, 14).toString('hex');
    console.log("trgb",trgb) ;
    if (trgb == '0300') {
        trgb = '0310';
    } else if (trgb == '0400') {
        trgb = '0410';
    } else {
        console.error("Message Type error:", trgb);
        if ( port !== '11108') chunk = Buffer.concat([  Buffer.from(chunk.length.toString().padStart(4,'0')), chunk ]);
        this.socket.write(chunk);
        return;
    }
/*
    const bitmap1 = solution(parseInt(dat.slice(14, 18).toString('hex'), 16))
        + solution(parseInt(dat.slice(18, 22).toString('hex'), 16));
    const bitmap2 = solution(parseInt(dat.slice(22, 26).toString('hex'), 16))
        + solution(parseInt(dat.slice(26, 30).toString('hex'), 16));
    const bitmap3 = solution(parseInt(dat.slice(30, 34).toString('hex'), 16))
        + solution(parseInt(dat.slice(34, 38).toString('hex'), 16));
    let bparr = ['0', '0'].concat(bitmap1.split('').slice(1));
    if (bitmap1[0] == '1') bparr = bparr.concat('0', bitmap2.split('').slice(1));
    if (bitmap2[0] == '1') bparr = bparr.concat(bitmap3.split(''));
*/
    let ssw = 0;
    let pos = 30;
    let bitmap = ('0'.repeat(32) + parseInt(dat.slice(14, 18).toString('hex'), 16).toString(2)).slice(-33)
                + ('0'.repeat(32) + parseInt(dat.slice(18, 22).toString('hex'), 16).toString(2)).slice(-32)
                + ('0'.repeat(32) + parseInt(dat.slice(22, 26).toString('hex'), 16).toString(2)).slice(-32)
                + ('0'.repeat(32) + parseInt(dat.slice(26, 30).toString('hex'), 16).toString(2)).slice(-32) ;
    if ( bitmap[65] == '1' ) {
        bitmap += ('0'.repeat(32) + parseInt(dat.slice(30, 34).toString('hex'), 16).toString(2)).slice(-32)
                + ('0'.repeat(32) + parseInt(dat.slice(34, 38).toString('hex'), 16).toString(2)).slice(-32) ;
        pos = 38 ;
    }

//  console.log(cdate(),new Date(), 'BC Messge bitmap:', bitmap.length - 1, bitmap.slice(1) );
//  print_bitmap(bitmap.slice(1)) ;
    bitmap = Buffer.from(bitmap);
    let rdat = Buffer.from('');

    for (let i = 2 ; i < bitmap.length; i++ ) {
        if (i == 65) continue ;
        if (bitmap[i] == 48 ) {
            if ( i == 39 ){
                rdat = Buffer.concat([rdat, Buffer.from(trgb == '0410' ? '02' : '01')]);
                bitmap.write('1',i) ;
            }
            continue;
        }
        
        if (bclay[i] == undefined) {
            console.error(cdate(),"undefined:", i, );
            continue;
        }
        let len = 0;
        if (bclay[i].fv === 'v') {
            if (bclay[i].vl > 1) {
                len = parseInt(dat.slice(pos, pos + bclay[i].vl).toString());
                if ( ! bclay[i].incl ) len += bclay[i].vl ;
            } else {
                len = dat.readUInt8(pos);
                if (bclay[i].t == 'b') len = Math.ceil(len / 2);
                if ( ! bclay[i].incl )  len++;
                
            }
            if (len == 0)  {
                console.error(cdate(),"length error:",i, bclay[i]);
                continue ;
            }
        } else if (bclay[i].fv === 'f') {
            len = bclay[i].l;
        } else {
            console.error(cdate(),"FV UNDEFINE", i);
            break;
        }
            //    if (i == 118) {
        //
        //const rdat118 = Buffer.from('999041000'+sno+'0'.repeat(633)) ;
        //console.log(cdate(),"118:",rdat118.length,"["+rdat118.toString('hex')+"]" ) ;
        //rdat = Buffer.concat( [ rdat, rdat118 ]);
        //    } else if (i == 55) {
        //        const rdat55 = Buffer.from('0'.repeat(256)) ;
        //        rdat55.writeUInt8(255,0) ;
        //        rdat = Buffer.concat( [ rdat, rdat55]) ;
        //        len =  256 ;
        //    } else {

        if (len <= 1) {
            console.error(cdate(),"pos:",pos,i, bclay[i], dat.slice(pos,pos+10).toString('hex') );
        }
        let imdt = Buffer.from(dat.slice(pos, pos + len));

        if (i == 39) {
            imdt = Buffer.from('01');
        }
        if (imdt.length > len)  imdt = imdt.substr(0,len) ;
//      if (trgb == '0410' && i == 118) console.log("0400 118:[", imdt.slice(0,13).toString(),"]" );
        if (i == 118 && trgb !== '0410') {
            const sno = Date.now().toString().slice(-8);
            imdt.write(sno, 5, 8);
//          console.log("118*[", imdt.slice(0,13).toString(),"]" );
            //          imdt = imdt.slice(1);
        }
//      if (trgb == '0410') console.log(i,"pos:",pos, "len:", len, imdt.toString('hex'));
        pos += len;
        if (i == 23 || i == 25 || i == 32 || i == 49 || i == 52 ||  i == 60 || i == 90  || i == 55 && trgb == '0410') {
            bitmap.write('0', i);
            continue;
        }
        if (i == 3 && imdt.toString('hex') == '010000')  ssw = 1;
        if (port == '21416' || port == '21417') {
            if (ssw == 1 && (i == 118 || i == 55) ) {
                bitmap.write('0', i);
                continue;
            }
        }
        // if (i == 55) {
        //  imdt = Buffer.from("06910800000012",'hex') ;
        // }
        rdat = Buffer.concat([rdat, imdt]);
    }
    if (port == '21416' || port == '21417') {
        if (bitmap[139] == 48 && ssw == 1 ) {
            if (bitmap.length < 130) bitmap = Buffer.concat([bitmap, Buffer.from('0'.repeat(64))]) ;
            bitmap.write('1', 65);
            bitmap.write('1', 139);
            rdat = Buffer.concat([rdat, Buffer.from('000000000000000000','hex')]) ;
        }
    }

//  if (pos < dat.length ) rdat = Buffer.concat([rdat, dat.slice(pos)]);
//  const bitmapN = (parseInt(bitmap.slice(1),2).toString(16)).toUpperCase() ;
    let bitmapN = '';
    for (let pi=1; pi+8 <= bitmap.length ; pi+=8 ) {
        bitmapN += ('0'+ (parseInt(bitmap.slice(pi,pi+8),2).toString(16)).toUpperCase()).slice(-2) ;
    }
    rdat = Buffer.concat([dat.slice(0, 12), Buffer.from(trgb + bitmapN, 'hex'), rdat]);
    if (port == '11108' ) {
        pff = rdat.indexOf(0xff) ;
        while (pff > 0 ) {
            rdat = Buffer.concat([rdat.slice(0,pff), Buffer.from('ff','hex'), rdat.slice(pff)]) ;
            pff = rdat.indexOf(0xff, pff+2) ;
        } 
        rdat = Buffer.concat([ rdat,  Buffer.from('FFEF','hex')]);
//      if (trgb = '0410') console.log(rdat.toString('hex')) ;
    } else {
        rdat = Buffer.concat([  Buffer.from(rdat.length.toString().padStart(4,'0')), rdat ]);
    }
    this.socket.write(rdat);
    console.log('1234567890'.repeat(13));
    console.log(bitmap.slice(1).toString());
    console.log(cdate(), "return bitmap:", bitmapN.length , bitmapN );
    // print_bitmap(bitmap.slice(1).toString()) ;
    console.log(cdate(),"last len:", rdat.length) ; //, rdat.toString('hex'));
    return '';
}

function dataProc6770(sock, chunk) {
    this.socket = sock;
    let dat = Buffer.from(chunk) ;
    if ( port == '11108' ) {
        let pff = dat.indexOf(Buffer.from('ffff','hex')) ;
        while (pff > 0 ) {
            dat = Buffer.concat([dat.slice(0,pff), dat.slice(pff+1)]) ;
            pff = dat.indexOf(Buffer.from('ffff','hex')) ;
        }
    }
    console.log("** 6770") ;
    dat.write('6771',12);
    dat.write('00',169) ;
    dat = Buffer.concat([  Buffer.from(dat.length.toString().padStart(4,'0')), dat ]);
    
    this.socket.write(dat);
    console.log(cdate(),"return:",dat.toString()) ;
    return '';
}

function print_bitmap(bm) {
    const bma = bm.split('') ;
    console.log(cdate(),"<<bit map") ;
    for (let i = 0; i < bma.length ; i++) {
        process.stdout.write((i+1) +":"+bma[i] + " ") ;
    }
    console.log(cdate(),'>>');
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

const lay55 = [
    [2,11],
    [2,4],
    [2,21],
    [3,7],
    [2,5],
    [1,7],
    [1,5],
    [1,3],
    [2,9],
    [2,5],
    [1,4],
    [2,5],
    [2,9],
    [2,6],
    [2,6],
    [2,4],
    [2,11],
    [2,4],
    [1,9],
    [2,5],
    [2,7]
] ;
const bclay = {
    2: { "l": 11, "t": "b", "fv": "v" },
    3: { "l": 3, "t": "b", "fv": "f" },
    4: { "l": 8, "t": "b", "fv": "f" },
    7: { "l": 5, "t": "b", "fv": "f" },
    11: { "l": 3, "t": "b", "fv": "f" },
    12: { "l": 3, "t": "b", "fv": "f" },
    13: { "l": 2, "t": "b", "fv": "f" },
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
    42: { "l": 15, "t": "n", "fv": "f" },
    44: { "l": 26, "t": "a", "fv": "v" },
    47: { "l": 256, "t": "a", "fv": "v" },
    49: { "l": 2, "t": "b", "fv": "f" },
    52: { "l": 8, "t": "b", "fv": "f" },
    55: { "l": 256, "t": "e", "fv": "v" },
    60: { "l": 9, "t": "a", "fv": "v" },
    90: { "l": 21, "t": "b", "fv": "f" },
    118: { "l": 999, "t": "n", "fv": "v", "vl": 3, "incl":1 },
    126: { "l": 83, "t": "a", "fv": "v", "vl": 3 },
    130: { "l": 3, "t": "b", "fv": "f" },
    131: { "l": 5, "t": "b", "fv": "f" },
    132: { "l": 4, "t": "b", "fv": "f" },
    134: { "l": 32, "t": "a", "fv": "v" },  // layout 불일치
    136: { "l": 8, "t": "b", "fv": "f" },
    137: { "l": 2, "t": "b", "fv": "f" },
    138: { "l": 2, "t": "b", "fv": "f" },
    139: { "l": 10, "t": "x", "fv": "f" },
    142: { "l": 256, "t": "b", "fv": "v" },
    143: { "l": 21, "t": "b", "fv": "v" },
    144: { "l": 1, "t": "b", "fv": "f" },
    145: { "l": 2, "t": "b", "fv": "f" },
    146: { "l": 3, "t": "b", "fv": "f" },
    147: { "l": 6, "t": "b", "fv": "f" },
    148: { "l": 2, "t": "b", "fv": "f" },
    149: { "l": 6, "t": "b", "fv": "f" }
}
    ;

