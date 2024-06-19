module.exports = {
	aqttype : 'TCP',
    tcode:null,
    srcip: '',
    dstip: '172.16.8.88' ,
    dstport:'' ,
    svcid:'',
    ptype:'F',
    dstv:null,
    otherCond :'! port 5000 ', // ex ->   ' && ( port 80 || 8080 ) '
    norcv:null,   // 'Y' 또는 'X' -> 응답데이터 없이 송신만, X값일 경우 db에 저장하지 않음
    conn:null,
	maxcnt:0,
    jobId:0
};
