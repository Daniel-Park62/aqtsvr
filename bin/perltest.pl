use strict;

open(my $FF,"<","esctest.dat") ;
open(my $FO,">", "escout.dat") ;
my $aa = <$FF> ;# q{01234567=[1m~D[1m^Ev@} ;
chomp $aa ;
my $bb = join ("@@@", "jhahj##", substr($aa,4,10) ) ;

print $FO $aa,"\n",$bb,"\n" ;

close $FF ;
close $FO ;