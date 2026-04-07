#!/usr/bin/bash

while :
do
		$AQTHOME/bin/aqtconn "select pkey from texecjob \
			 WHERE reqstartdt <= NOW() and resultstat=1 and jobkind in (2,8,9) and ppkey = 0 \
			   AND tcode IN (SELECT tcode FROM vtcase WHERE pro != '3') order by reqstartdt LIMIT 1" | while read pkey
		do
			if [ -z $pkey ]; then break ; fi
#			echo "$pkey " ;
			$AQTHOME/bin/aqtconn "UPDATE texecjob SET resultstat = 2, startDt=NOW(), endDt=NULL WHERE pkey=$pkey; commit;" ;
			(node ./aqt_execjob.js $pkey ; ./aqt_execChildjs.sh $pkey ) &  
		done
		
		read pkey pidv <<<`$AQTHOME/bin/aqtconn "select pkey,pidv from texecing where reqkill = '1' LIMIT 1 "` ;
		if [[ $pidv -gt 0 ]]; then 
			echo "Kill Job pkey:$pkey pid:$pidv ";
			(kill $pidv ) &
		fi
		[ -n "$pkey" ] && \
		    $AQTHOME/bin/aqtconn "UPDATE texecing SET reqkill='' where pkey=$pkey; update texecjob set resultstat = 9 where pkey=$pkey ; commit;" ;
		sleep 3;
done
