ps -fl |grep "./aqt_sendS -t " |grep -v grep | awk '{print "kill",$2}' | sh -v
sleep 1
ps -fl |egrep "./(aqt_execMst|aqt_request)" |grep -v grep | awk '{print "kill",$2}' | sh -v
