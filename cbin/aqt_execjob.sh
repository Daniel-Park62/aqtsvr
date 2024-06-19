#!/bin/bash
#   tnum:송신데몬수, intm:송신간격

[ -z $1 ]  && echo "Need to Job-id" ;
IFS="@" read pkey tcode tnum intm repnum dbskip exectype etc limits <<< \
 `$AQTHOME/bin/aqtconn "select concat(pkey,'@', tcode,'@', tnum,'@',reqnum,'@',repnum,\
 '@',dbskip,'@', exectype,'@',ifnull(etc,' ')),'@',limits \
                 from texecjob WHERE pkey = $1  and jobkind=9 and resultstat=1 " `
if [ -z $pkey ]; then exit ; fi
echo "$pkey $tcode $tnum $intm $dbskip $exectype $etc $limits"

COND="TCODE='$tcode'" ;
[ ${#etc} -gt 6 ] && COND="$COND AND (${etc//\"/\'})" ;
echo $COND ;

read lvl target <<<`$AQTHOME/bin/aqtconn "select lvl,thost from tmaster where code = '$tcode'" ` ;

[ $tnum -lt 3 ] && tnum=3;

COND="" ;

if [ ${#etc} -gt 5 ]; then
	COND="-e \"$etc\"" ;
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

limits=${limits##* }
echo "limits=[$limits]"
if [[ ${limits} > " " ]]; then
	COND="-u ${limits} $COND" ;
	echo $COND;
fi

MKEY=$$

LOGF="${AQTLOG}/"`date +%Y%m%d`"_${MKEY}.mlog"
echo "./aqt_sendS -t $tcode $COND -i $intm -p $tnum -x$1 >>$LOGF 2>&1" | sh -v 

$AQTHOME/bin/aqtconn "update tmaster set tdate = curdate() where code = '$tcode' ; call sp_summary('$tcode') ;  commit; " ;

echo "** $tcode tpcall End. **"
