
FL=`ls -rt ${AQTLOG}/*[rm]log 2>/dev/null | tail -1`

if [ -n $FL ]; then 
  cat $FL ; echo $FL ; 
else
  echo 'Not found log'
fi

