
FL=`ls -t ${AQTLOG}/*[rms]log 2>/dev/null | head -1`

if [ -n $FL ]; then 
  cat $FL ; echo $FL ; 
else
  echo 'Not found log'
fi

