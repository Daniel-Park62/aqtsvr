
// const conp = require('./db/db_con1'); 
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function main() {
    const con = await require('./db/db_con1');
    let cc=0
    con.query("select code from tmaster").then(row => console.log(row[0])) ;
    const cmd = "SELECT t.pkey,o_stime " +
    "FROM ttcppacket t join tmaster c on (t.tcode = c.code ) left join thostmap m on (t.tcode = m.tcode and t.dstip = m.thost and t.dstport = m.tport) " ;
    for await (const row of con.queryStream(cmd)) {
//		setImmediate( () => { console.log(row); con.resume()} );
babo(++cc);
        await sleep(0) ;
	}
	con.end();
    console.log('th end');
}
function babo(c){
    console.debug("I am babo!!",c) ;
}
main() ;
/*

const { networkInterfaces } = require('os');

const nets = networkInterfaces();

for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === 'IPv4' && !net.internal) {
            console.log(name ,net.address);
        }
    }
};

const tobj = JSON.parse(process.argv[2]) ;
console.log(tobj) ;
*/