
for FL in `ls -rt ${AQTLOG}/*.*log 2>/dev/null | tail -2` ;
do
  [[ $FL =~ mlog$ ]] && head $FL ; tail -60 $FL ; echo "---<< $FL end of file >>---" ; 
done
