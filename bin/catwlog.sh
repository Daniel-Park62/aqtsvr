
for FL in `ls -rt ${AQTLOG}/*.log 2>/dev/null | tail -2` ;
do
  echo $FL ; tail -100 $FL ; echo "---<< end of file >>---" ; 
done
