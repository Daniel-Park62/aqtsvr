
kill `ps -ef |grep "./aqt_sendS -t " |grep -v grep | awk '{printf "%d ",$2}'` 2>/dev/null
sleep 1
kill `ps -ef |egrep "./(aqt_execMst|aqt_request)" |grep -v grep | awk '{printf "%d ",$2}'` 2>/dev/null

: <<COMM
while IFS= read -r JJ  
do
  echo $JJ|sh ;
done < <(ps -ef |egrep "./(aqt_execMst|aqt_request)" |grep -v grep | awk '{print "kill",$2}' )
COMM
