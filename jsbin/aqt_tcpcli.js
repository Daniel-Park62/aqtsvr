var net = require('net');
const port = process.argv[2] ?? 10002;

var socket = net.connect({port : port});
socket.on('connect', function(){
	console.log('connected to server!');
	
	// 1000ms의 간격으로 banana hong을 서버로 요청
	setInterval(function(){
		socket.write('9843784398349929399834834873949934933399898989899999999996abdef6666666666666333334837887872378828283828382388483488348348348');
	}, 1000);

});

// 서버로부터 받은 데이터를 화면에 출력
socket.on('data', function(chunk){
	console.log('recv:' + chunk);
  socket.write(Buffer.from('FFFD19','hex')) ;
});
// 접속이 종료됬을때 메시지 출력
socket.on('end', function(){
	console.log('disconnected.');
});
// 에러가 발생할때 에러메시지 화면에 출력
socket.on('error', function(err){
	console.log(err);
});
// connection에서 timeout이 발생하면 메시지 출력
socket.on('timeout', function(){
	console.log('connection timeout.');
});
