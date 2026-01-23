const net = require('net');
const port = process.argv[2] ?? 10002;

const sdata = Buffer.from("0가나다라대한민국서울여의도대오빌딩ABKIKSDKKKSD9999999010100010000E") ;
const socket = net.createConnection({port : port, host:'0.0.0.0'});  
socket.on('connect', function(){
	console.log('connected to server!');
	
	// 1000ms의 간격으로 banana hong을 서버로 요청
	setImmediate(()=>{
		sdata.writeInt8(sdata.length -1);
		socket.write(sdata);
	}, 1000);

});

// 서버로부터 받은 데이터를 화면에 출력
socket.on('data', function(chunk){
	console.log('recv:' , chunk.toString());
	// try {
	// 	chunk.write('xx',6) ;
	// } catch (error) {
	// 	console.log(error) ;
	// }
//  socket.write(Buffer.from('DAWIN')) ;
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
