#!/bin/bash

while :
do
	PK=$($AQTHOME/bin/aqtconn "select pkey from texecjob WHERE resultstat=1 and ppkey = $1 limit 1" );
	[ ${#PK} -lt 1 ] && exit ;
	PK=$($AQTHOME/bin/aqtconn "select pkey from texecjob WHERE  pkey = $1 and resultstat in (2,9) " );
	[ ${#PK} -lt 1 ] && exit ;

	$AQTHOME/bin/aqtconn "select pkey from texecjob \
			WHERE reqstartdt <= NOW() and resultstat=1 and ppkey = $1 \
				AND exists (SELECT 1 FROM texecjob WHERE pkey = $1 and resultstat = 9 ) order by reqstartdt LIMIT 1" | while read pkey
	do
		[ ${#pkey} -lt 1 ] && break ; 
		echo "$pkey " ;
		$AQTHOME/bin/aqtconn "UPDATE texecjob SET resultstat = 2, startDt=NOW(), endDt=NULL WHERE pkey=$pkey; commit;" ;
		(node ./aqt_execjob.js $pkey ; $0 $pkey) &  
	done
	sleep 3;
done
