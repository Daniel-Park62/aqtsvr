cd $AQTHOME/jsbin
LOGF1="${AQTLOG}/"`date +%Y%m%d`"_$$.jslog"
LOGF2="${AQTLOG}/"`date +%Y%m%d`rs"_$$.jslog"
./aqt_killJs.sh
./aqt_execMstjs.sh >$LOGF1 2>&1 &
node aqt_resend.js >$LOGF2 2>&1 &
