
function aa() {
    return new Promise((resolve) => {
        setTimeout(() => resolve("ok") , 3000);
    });
}
(async () => { xx = aa(); console.log(xx) })()  ;
console.log("ggg");
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