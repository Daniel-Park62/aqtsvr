#!/bin/bash

while :
do
		$AQTHOME/bin/aqtconn "select pkey from texecjob \
			 WHERE reqstartdt <= NOW() and resultstat=0 and jobkind=9 \
			   AND tcode IN (SELECT code FROM tmaster WHERE pro = '3') order by reqstartdt LIMIT 1" | while read pkey
		do
			if [ -z $pkey ]; then break ; fi
			echo "$pkey " ;
			$AQTHOME/bin/aqtconn "UPDATE texecjob SET resultstat = 1, startDt=NOW(), endDt=NULL WHERE pkey=$pkey; commit;" ;
			(./aqt_execjob.sh $pkey) &  
		done
		sleep 0.2;
done
