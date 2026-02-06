#!/bin/bash
#   tnum:송신데몬수, intm:송신간격

[ -z $1 ]  && echo "Need to Job-id" ;
IFS="@" read pkey tcode tnum intm repnum dbskip exectype etc limits <<< \
 `$AQTHOME/bin/aqtconn "select concat(pkey,'@', tcode,'@', tnum,'@',reqnum,'@',repnum,\
 '@',dbskip,'@', exectype,'@',ifnull(etc,' '),'@',trim(limits)) \
                 from texecjob WHERE pkey = $1  and jobkind=9 and resultstat=2 " `
if [ -z $pkey ]; then exit ; fi
echo "$pkey $tcode $tnum $intm $dbskip $exectype $etc $limits"

COND="TCODE='$tcode'" ;
[ ${#etc} -gt 6 ] && COND="$COND AND (${etc//\"/\'})" ;
echo $COND ;

read lvl target <<<`$AQTHOME/bin/aqtconn "select lvl,thost from tmaster where code = '$tcode'" ` ;

[ $tnum -lt 3 ] && tnum=3;

COND="" ;
COND2="" ;
SELCNT="" ;

if [ ${#etc} -gt 5 ]; then
	COND="-e \"$etc\"" ;
	COND2="AND $etc";
fi

if [ ${dbskip} -eq 1 ]; then
	COND="-d $COND" ;
fi

if [ ${exectype} -eq 1 ]; then
	COND="-k $COND" ;
fi

if [ ${repnum} -gt 1 ]; then
	COND="-r ${repnum} $COND" ;
fi

echo "limits=[$limits]"
if [[ ${limits} > " " ]]; then
  SELCNT=`echo ${limits}|cut -d, -f2|awk '{printf("-c %s",$1)}'` ;
	COND="-u ${limits} $COND" ;
	COND2="$COND2 LIMIT $limits" ;
	echo $COND;
fi

MKEY=$$

LOGF="${AQTLOG}/"`date +%Y%m%d`"_${MKEY}.mlog"
#  read tcnt <<<`$AQTHOME/bin/aqtconn "select count(1) from ttcppacket where tcode = '$tcode' $COND2" ` ;
$AQTHOME/bin/aqtconn "INSERT INTO texecing (pkey) values ($pkey) on duplicate key update tcnt=1,ccnt=0,ecnt=0 ;   commit; " ;
echo "./aqt_sendS -t $tcode $COND ${SELCNT} -i $intm -p $tnum -x$1 >>$LOGF 2>&1" | sh -v 
$AQTHOME/bin/aqtconn "update tmaster set tdate = curdate() where code = '$tcode' ;   commit; " ;

echo "** $tcode tpcall End. **"
