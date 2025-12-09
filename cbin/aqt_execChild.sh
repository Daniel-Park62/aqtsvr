#!/bin/bash

while :
do
		$AQTHOME/bin/aqtconn "select pkey from texecjob \
			 WHERE reqstartdt <= NOW() and resultstat=0 and jobkind=9 and ppkey = $1 \
			   AND exists (SELECT 1 FROM texecjob WHERE pkey = $1 and resultstat=2) order by reqstartdt LIMIT 1" | while read pkey
		do
			if [ -z $pkey ]; then exit ; fi
			echo "$pkey " ;
			$AQTHOME/bin/aqtconn "UPDATE texecjob SET resultstat = 1, startDt=NOW(), endDt=NULL WHERE pkey=$pkey; commit;" ;
			(./aqt_execjob.sh $pkey; ./aqt_execChild $pkey) &  
		done
		sleep 0.2;
done
