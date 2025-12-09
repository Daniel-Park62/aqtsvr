
kill `ps -ef |egrep "node (aqt_execJob|aqt_resend).js" |grep -v grep | awk '{printf "%d ",$2}'` 2>/dev/null