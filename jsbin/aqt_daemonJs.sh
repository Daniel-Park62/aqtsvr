cd $AQTHOME/jsbin
LOGF1="${AQTLOG}/"`date +%Y%m%d`"_$$.jslog"
LOGF2="${AQTLOG}/"`date +%Y%m%d`rs"_$$.jslog"
./aqt_killJs.sh
node aqt_execJob >$LOGF1 2>&1 &
node aqt_resend >$LOGF2 2>&1 &
