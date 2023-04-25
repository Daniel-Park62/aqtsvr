
kill `ps -ef |egrep "node (aqt_execJob|aqt_resend)" |grep -v grep | awk '{printf "%d ",$2}'` 2>/dev/null