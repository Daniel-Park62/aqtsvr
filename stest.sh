#!/usr/bin/bash
if [ $# -lt 1 ];then
  echo "사용법: $0 대상로그파일명" ;
  exit ;
fi
mysql  -N -s <<EOFL

use aqtdb2 ;

SET @@session.autocommit=1;

select * from tloaddata where tcode = '$1' ;
EOFL
