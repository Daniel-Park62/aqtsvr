// tcp 기본서버 
const Net = require('net');
const logger = require('../lib/logs/aqtLogger').child({ label: "tcpsvr" });
const mdb = require('../db/db_con1.js');
const port = process.argv[2] ?? 10002;
const svrno = process.argv[3] ?? 0;

const server = new Net.Server();
let con ;

server.listen(port, function() {
    logger.info(`Server listening for connection requests on Port:${port}`);
    if (svrno > 0 ) update_status(svrno) ;
});

server.on('connection', function(socket) {
    logger.info('A new connection has been established.');

    // The server can also receive data from the client by reading from its socket.
    socket.on('data', function(chunk) {
        logger.info("Data received from client:", chunk.toString());
		socket.write('ok');
		socket.write(chunk);
    });

    // When the client requests to end the TCP connection with the server, the server
    // ends the connection.
    socket.on('end', function() {
        logger.info('Closing connection with the client');
    });

    // Don't forget to catch error, for your own sake.
    socket.on('error', function(err) {
        logger.error(`Error: ${err}`);
    });
});

async function update_status(svrno) {
    console.log('update....');
    con = await mdb;
    await con.query(`update tmocksvr set status=2 where pkey=?`,[svrno]) ;
    // con.end();
}
async function endfunc() {
    if (svrno > 0) {
        await con.ping() ;
        await con.query(`update tmocksvr set status=0 where pkey=?`,[svrno]) ;
    }
    logger.info(`end Server port:${port}`) ;
    process.exit(0);
}
process.on('SIGINT', endfunc);
process.on('SIGTERM', endfunc);
process.on('uncaughtException', (err) => { logger.error(err.message) });