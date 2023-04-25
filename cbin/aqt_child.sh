#!/bin/bash

PP='{"norcv":"X"'

test -n ""$1 && PP+=',"svcid":"'$1'"'

PP+='}'

node ${AQTHOME}/jsbin/aqt_ToDb.js ZDUMMY ${AQTHOME}/dmpdata/dmp082715.pcap $PP

