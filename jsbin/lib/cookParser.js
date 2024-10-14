const ckMap = new Map() ;

exports.change_cookie = function(odata, svKey, uri) {
  const ckData = exports.parseCookie(odata);
  const sv_ck = ckMap.get(svKey);

  for (const k in sv_ck) {
    const re = new RegExp("^" + k);
    // console.log("###", k, uri);
    if (!re.test(uri)) continue;
    for (const k2 in sv_ck[k]) {
      if (/Expires|path|HttpOnly|Max-Age|Domain|SameSite/i.test(k2)) continue;
      if (ckData[k2]) ckData[k2] = sv_ck[k][k2];
    }
  }
  let newVal = '';
  for (const [k, v] of Object.entries(ckData)) newVal += k + '=' + v + ';';
  return newVal;
} ;

exports.parseCookie = function(cookie = '') {
// console.log("cookie : ",cookie);
return cookie
  .split(';')
  .map(v => v.split('='))
  .map(([k, ...vs]) => [k, vs.join('=')])
  .reduce((acc, [k, v]) => {
    acc[k.trim()] = v; // decodeURIComponent(v);
    return acc;
  }, {});
};

exports.saveCookie = function(cook,svkey) {
if (typeof cook !== 'string' ) return ;
const ckData = exports.parseCookie(cook);
const path = ckData.Path || '/';
let sv_ckData = ckMap.get(svkey) || {};
let xdata = sv_ckData[path] || {};
for (const k in ckData) {
  if (/Path|HttpOnly|Secure/.test(k)) continue;
  xdata[k] = ckData[k];
}
sv_ckData[path] = xdata;
ckMap.set(svkey, sv_ckData);
} ;

exports.printMap = function(svkey) {
  console.log(ckMap.get(svkey)) ;
}
