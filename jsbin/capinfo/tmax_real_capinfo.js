module.exports = {
	aqttype : 'TMAX',
    tcode:'REAL',
    srcip: '',
    dstip: '239' ,
    dstport:'' ,
    svcid:'',
    ptype:'R',
    dstv:'',
    orderOpt: '',
    otherCond :'', // ex ->   ' && ( port 80 || 8080 ) '
    norcv:'X',   // 'Y' 또는 'X' -> 응답데이터 없이 송신만, X값일 경우 db에 저장하지 않음
    conn:null,
	maxcnt:0,
    jobId:0
};
