cd $AQTHOME/cbin
LOGF="${AQTLOG}/"`date +%Y%m%d`"_$$.rlog"
./aqt_kill.sh
./aqt_execMst.sh >/dev/null &
./aqt_request >$LOGF 2>&1 &

