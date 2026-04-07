
kill `ps -ef |egrep "node aqt_resend.js|aqt_execMstjs" |grep -v grep | awk '{printf "%d ",$2}'` 2>/dev/null