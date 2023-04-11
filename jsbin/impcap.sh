#!/bin/bash

node aqt_ToDb.js $1 $2.pcap $3""

for i in {1..40}
do
	[ ! -f $2.pcap$i ] && continue ;
	node aqt_ToDb.js $1 $2.pcap$i $3""
done

