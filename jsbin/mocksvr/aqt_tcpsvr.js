// tcp 기본서버 
const Net = require('net');
const mdb = require('../db/db_con1');

const port = process.argv[2] ?? 10002;
const pgno = process.argv[3] ?? 0;

const server = new Net.Server();

server.listen(port, function() {
    console.log(`Server listening for connection requests on Port:${port}`);
    if (pgno) update_status(pgno) ;
});

server.on('connection', function(socket) {
    console.log('A new connection has been established.');

    // The server can also receive data from the client by reading from its socket.
    socket.on('data', function(chunk) {
        console.log("Data received from client:", chunk.toString());
		socket.write('ok');
		socket.write(chunk);
    });

    // When the client requests to end the TCP connection with the server, the server
    // ends the connection.
    socket.on('end', function() {
        console.log('Closing connection with the client');
    });

    // Don't forget to catch error, for your own sake.
    socket.on('error', function(err) {
        console.log(`Error: ${err}`);
    });
});

async function update_status(pgno) {
    const con = await mdb ;
    con.query(`update tmocksvr set status=1 where pkey=?`,pgno) ;
}
async function endfunc() {
    if (pgno) {
    const con = await mdb ;
    con.query(`update tmocksvr set status=0 where pkey=?`,pgno)
    .catch( e => console.log(e.message)) ;
    }
    process.exit(0);
}
process.on('SIGINT', endfunc);
process.on('SIGTERM', endfunc);