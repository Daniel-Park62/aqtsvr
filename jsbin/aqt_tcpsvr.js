// Include Nodejs' net module.
const Net = require('net');
// The port on which the server is listening.
const port = process.argv[2] ?? 10002;

// Use net.createServer() in your code. This is just for illustration purpose.
// Create a new TCP server.
const server = new Net.Server();
// The server listens to a socket for a client to make a connection request.
// Think of a socket as an end point.
server.listen(port, function() {
    console.log(`Server listening for connection requests on socket localhost:${port}`);
});

// When a client requests a connection with the server, the server creates a new
// socket dedicated to that client.
server.on('connection', function(socket) {
    console.log('A new connection has been established.');
    socket.write('0056' + '0'.repeat(56)) ;

    // The server can also receive data from the client by reading from its socket.
    socket.on('data', function(chunk) {
        console.log("Data received from client:", chunk.toString());
		socket.write('ok');
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