export AQTHOME=/mnt/f/AQTAPP/aqtsvr
export AQTLOG=${AQTHOME}/logs
export AQTWEB=/mnt/f/AQTAPP/AQT-WEB
export AQTDBIP=172.22.160.1
# AQTDBPORT=3306
# AQTDBNAME=aqtdb2
# AQTDBUSER=
# AQTDBPASS=
# AQTTYPE=    ( TMAX, TCP, HTTP ) default HTTP
# AqtTimeOut=30000  기본 30초 설정 , tcp or http timeout값 
[[ ${PATH} =~ $AQTHOME/bin ]] || export PATH=${PATH}:${AQTHOME}/bin

echo "AQTHOME=$AQTHOME AQTWEB=$AQTWEB AQTLOG=$AQTLOG"
echo "AQTDBIP=${AQTDBIP}"

alias cdbin='cd $AQTHOME/bin'
alias cdjsbin='cd $AQTHOME/jsbin'
alias cdweb='cd $AQTWEB'
