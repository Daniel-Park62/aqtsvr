const cParser = require('./cookParser') ;
const ktoa = require('./ktoainfo') ;

const tval = 'L-VISITOR=zgh80gco71e86; SMSESSION=u4LZqpD2wcRrNLkUR1UeqRESQU0nF7%2BgWlZGire15%2FpvSK3c2QjVAigCOBfXfCeYKA2J%2FV64Lv7oCTZ3fNmqRggUAYpsY4zbZMzfhAJBIrVsKHmbZeYPMK7Q%2BQRIL9PYgidhXrsnmwCd%2BPdQ21Z1E9ux3ITcK8DbZCBBrNxVUy%2BELzSZdkTi3tjSMUd1CuIMHD8YtQu2yu5nuprtMBM2s%2FlWPWN0bwB3jnHz0cMEJ1vzh7SRxeb38%2FWP5j%2FpUpKm%2FkOmJ9u6wuvw9nPAGUXTN0tr3ydGBo15FpB8lHEOTYynOIXF6jxfEiOBnusJ%2B3k8iOs9uIa0InoqMoTOr98CqR7u9W0EAWEtCIomwpS%2FRN%2FWS1tE089DUCj11FdfEe0DSYAiN1m1DHe5kbAigeYOONHAO0xS%2BZaLKXjSlv3ljXdlmgKUBXJcvrEwCdkqHGgqMrbvk792bbMUvl5%2FSNE7XTQ2VVpmzRgHNKZwpcpXqDJcMKmpk8KAkFp8F1XAnIZJrUImoEz3TM9FAMNuFIdRj3AmxE8DFutG0ui7FxXOWHvk2wyhdZppIO3PuTMkh2bLLKB%2BuRSJ9Q4mXhq6qf85blY18T6ycxy3pBBK9sbKxqcdf9TvwwHqVf76QGTu37WRCx19qPECTK2FZB7PpGb%2B0BRahLqYMQlOXKdEP4DR%2BGoBcCGoVQouXLneDnRjNOx4DU4KBZgTyJqaR23JVECT8Olh%2BvDvSQ5nu3Bg1SQyN5F3rMfkB8CXuIIhGVWpCTpSYtE4K0CgTncwv36t9PQ3WX%2BKBVkZTjdk67UorMlFQpEpsRxaIzVg3cFTfjL4wGuTQvXEyZC63SwWf2y2usKLxzySaPkZZKYVu3CJ%2BBkFSzOLu6qQRGNyUQ%3D%3D; LENA-UID=5562a50.619a0a07bad06; SCOUTER=x28imi05ivn0ns; L-VISITOR=z7dqh5rj9iadla; eum-key=fdfb05f6-1e41-11ef-92c5-31108ac97894; eum-hash=-794090777; JSESSIONID=9C7B473946476044A142C065384AC7CB.8d99ee1a84b824141';
const cval = 'JSESSIONID=xxxxxxxxxxxx99';

cParser.saveCookie(cval,'KKK') ;
cParser.printMap('KKK') ;
console.log( cParser.change_cookie(tval,'KKK','/ss') );

const moment = require('moment') ;
const path = require('path');
console.log(process.argv[1], path.basename(process.argv[1]));
ss=moment() ;

const cdate =  () => 'XXX '+  moment().format("MM/DD HH:mm:ss.SSS :");

console.log(cdate()) ;
Object.keys(ktoa).forEach(k => {
  console.log(k, ktoa[k].localip);
})