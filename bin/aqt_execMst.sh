#!/bin/bash

while :
do
		./aqtconn "select pkey from texecjob \
			 WHERE reqstartdt <= NOW() and resultstat=0 and jobkind=9 order by reqstartdt LIMIT 1" | while read pkey
		do
			if [ -z $pkey ]; then break ; fi
			echo "$pkey " ;
			./aqtconn "UPDATE texecjob SET resultstat = 1, startDt=NOW(), endDt=NULL WHERE pkey=$pkey; commit;" ;
			(./aqt_execjob.sh $pkey) &  
		done
		sleep 5;
done
