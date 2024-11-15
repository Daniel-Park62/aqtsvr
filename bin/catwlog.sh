
for FL in `ls -t ${AQTLOG}/*.log 2>/dev/null | head -2` ;
do
  echo $FL ; tail -100 $FL ; echo "---<< end of file >>---" ; 
done
