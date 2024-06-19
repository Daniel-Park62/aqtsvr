module.exports = {
	aqttype : '',
    tcode:'REAL',
    srcip: '',
    dstip: '' ,
    dstport:'' ,
    svcid:'',
    ptype:'R',
    dstv:'',
    devno: '-i5',
    otherCond :'', // ex ->   ' && ( port 80 || 8080 ) '
    norcv:'X',   // 'Y' 또는 'X' -> 응답데이터 없이 송신만, X값일 경우 db에 저장하지 않음
    conn:null,
	maxcnt:0,
    jobId:0
};
