
// const conp = require('./db/db_con1'); 

async function main() {
    const con = await require('./db/db_con1');
    con.query("select code from tmaster").then(row => console.log(row[0])) ;
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