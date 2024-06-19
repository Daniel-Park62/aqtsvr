#!/usr/bin/perl
# ip change
use strict;
use warnings;
use File::Basename;
use File::Path qw(make_path) ;
use File::Copy;
use Getopt::Std;
sub Usage {
  die <<END
  $0 [-e] [-c dir] 디렉토리 검색파일
  -e : update
  -c dir : Dir to save orginal source
  
  예)
  $0 /abcdir/src "*.java"
  $#ARGV
END
;
}
my %ipNhost=map{my($a,$b) = split(/\s+/,$_); $a => $b} <DATA> ;
=cut
print join(",", keys %ipNhost),"\n" ;
print join(",", values %ipNhost),"\n" ;
=cut
Usage() if ($#ARGV < 1) ;
my %opts=();
getopts("ec:",\%opts) or Usage() ;
my $reg = qr!\b(10|172|192)(?:\.\d{1,3}){3}\b!x ;
$reg = join("|",keys %ipNhost) ;
$reg = qr!\b($reg)\b!x ;
$| = 1;
sub copy_origin ($) {
  return if (! defined($opts{c})  ) ;
  my $fname = shift;
  my $srcd = dirname $fname ;
  my $dst = $opts{c} . '/' . $srcd ;
  make_path($dst) ;
  copy($fname,$opts{c} . '/' . $fname) ;
}
sub file_anal {
  my $fname = shift || return ;
  open (my $FD,"<",$fname) || print STDERR "$? $fname\n" && return ;
  binmode $FD ;
  my $CHGCMT = ($fname =~ /\.(c|cc|pc|cpp|h|java)$/ ) ? "//TOBE: " : "# TOBE: " ;
  my @otext = <$FD>;
  my @ytext = @otext;
  my ($sw,$csw, $mcnt) = (0,0,0);
  foreach my $i (0..$#otext) {
    $ytext[$i] =~ s!/\*.*?(\*/)!! ;
    if ($ytext[$i] =~ s!/\*.*!!) {
      $csw = 1;
      next ;
    }
    $csw = 0 if ( $csw == 1 && $ytext[$i] =~ s!.*\*/!!) ;
    $ytext[$i] = '' if ($csw == 1);
    $ytext[$i] =~ s!(//|--|#).*$!!mg ;
  }
  foreach my $i (0..$#otext) {
    my @fwarr = ();
    while ($otext[$i] !~ m!//TOBE: ! && $ytext[$i] =~ /$reg/xg) {
      my $fword = $& ;
      push @fwarr,$fword ;
      if ($ipNhost{$fword}) {
        $otext[$i] =~ s!$fword!$ipNhost{$fword}! ;
#      } else{
#        $otext[$i] =~ s!$fword!0.0.0.0! ;
      }
      $sw = 1  if ($opts{e});
      $mcnt += $otext[$i] =~ s/\r//s if ($fname =~ /\.(c|cc|pc|cpp)$/i) ;
    }
	  if (0 < @fwarr) {
		  my $fwords = join ",",@fwarr ;
		  print "${fname}:";
	#        $otext[$i] =~ s!$! ${CHGCMT} ${fwords}!  ; # unless ( $opts{n}) ;
	#	print "(${CHGCMT} @fwarr)\n";
		print "\t$i\t$otext[$i]" ;
	  }
  }
  if ($mcnt) {
    printf "$fname : CR(%d) Changed.\n",$mcnt ;
    $sw = 1  if ( $opts{e}) ;
  }
  if ($fname =~ /\.(c|cc|pc)$/  && $otext[$#otext] !~ /\n/s ) {
    $otext[$#otext] .= "\n" ;
    $sw = 1  if ( $opts{e}) ;
    print "$fname : Last NewLine\n" ;
  }
  close $FD;
  if ( $sw ){
    copy_origin($fname) if ($opts{c}) ;
    open(my $FWD,">",$fname) || print STDERR "$? $fname\n"  && return ;
    print $FWD @otext ;
  }
}
#my @infiles = map {glob} @ARGV if (@ARGV > 0) ;
print "$ARGV[0]  $ARGV[1]\n";
my @infiles = `find $ARGV[0] -name "$ARGV[1]"` ;
foreach my $fl ( @infiles )
{
#  print STDERR "$fl\n" ;
  chomp($fl);
  next unless -f $fl ;
  next if ( -B $fl) ;
  file_anal($fl) ;
}
__DATA__
bche01ip
ezzd01ip
ezze01ip
flga01ip
szze01ip
szzh01ip
bche02ip
ezzd02ip
ezze02ip
flga02ip
szze02ip
szzh02ip
pzza01ip
szza01ip
pzza02ip
stcd01ip
szzd01ip
szzd03ip
czzd01ip
czzw01ip
rlza01ip
czzd02ip
czzw02ip
occa01ip
omaa01ip
omia01ip
ozzd01ip
ozze01ip
ozzh01ip
occa02ip
omaa02ip
omia02ip
ozzd02ip
ozze02ip
ozzh02ip
dszd01ip
dszw01ip
dszd02ip
dszw02ip
dafa01ip
daoa01ip
jaza01ip
dafa02ip
daoa02ip
jaza02ip
ssc_inter1
ssc_inter2
flga03ip
hhzc01ip
ssc_taxiair
vrza01ip
vvzw01ip
busa01ip
flga04ip
kkzc01ip
vrzd01ip
vvzw02ip
etcw01ip
ssc_taxi1
ssc_van1
vtzd01ip
etcw02ip
ssc_taxi2
ssc_van2
vtzd02ip
hhzd01ip
kkzd01ip
gbzd01ip
gbzh01ip
gbzw01ip
gbzd02ip
gbzh02ip
gbzw02ip
gbza01ip
gbze01ip
gbze02ip
gbze03ip
gbze04ip
ssc_cms1
dozh01ip
dozw01ip
umtw01ip
dozh02ip
dozw02ip
umtw02ip
dozd01ip
vvzd01ip
vvzr01ip
dozd02ip
vvzd02ip
vvzr02ip
mtza01ip
mtzapm01ip
mtzh01ip
mtzw01ip
mtza02ip
mtzh02ip
mtzw02ip
mtzd01ip
mtzd02ip
xtzh01ip
xtzh02ip
xtze03ip
xtze04ip
xtze01ip
xtze02ip
xtza01ip
xtza03ip
xtzd01ip
xtzw01ip
xtza02ip
xtza04ip
xtzd02ip
xtzw02ip
ezta01ip
eztd01ip
ezte01ip
ezth01ip
eztw01ip
ezta02ip
eztd02ip
ezte02ip
ezth02ip
eztw02ip
exbusftp1
exbusftp3
exbusftp4
exbusftp5
exbusinq1
exbusinq2
exbusapp1
exbusapp2
exbusdb1
exbusdb2
kobd01ip
kobh01ip
kobw01ip
kobd02ip
kobh02ip
kobw02ip
xzzh01ip
xzzh02ip
kacw01ip
kamw01ip
kacw02ip
kamw02ip
uccd01ip
uccd02ip
uccw01ip
uccw02ip
dckd01ip
dcvd01ip
dckw01ip
dcva01ip
mpze01ip
mpzh01ip
mpzw01ip
mpzd01ip
dcvh03ip
dckd02ip
dcvd02ip
dckw02ip
dcva02ip
mpze02ip
mpzh02ip
mpzw02ip
mpzd02ip
dcvh04ip
eoag01ip
eoag02ip
eoag03ip
eoag04ip
eoag05ip
eoag06ip
eoap01ip
eoap02ip
eoae01ip
eoar01ip
eoae02ip
eoar02ip
eoan02ip
eoan01ip
eoad01ip
eoad02ip
mmtd01ip
mmth01ip
mmtw01ip
tozh01ip
tozw01ip
tpzh01ip
tpzl01ip
tpzm01ip
tcca01ip
vpzh01ip
vpzw01ip
vpza01ip
tmdh01ip
mmtd02ip
mmth02ip
mmtw02ip
tozh02ip
tozw02ip
tpzh02ip
tpzl02ip
tpzm02ip
tcca02ip
vpzh02ip
vpzw02ip
vpza02ip
tmdh02ip
tmma01ip
upsw01ip
upsc01ip
upsd01ip
tisw01ip
tish01ip
woph01ip
wopw01ip
wopd01ip
upsw02ip
upsc02ip
upsd02ip
tisw02ip
tish02ip
cicd01ip
cicd02ip
vpzd01ip
tozd01ip
tisd01ip
vpzd02ip
tozd02ip
tisd02ip
KSCAMTPI03T
KSCAMTPI04T
KSCAMTPI05P
KSCAMTPI04P
bdpd01ip
bdpd02ip
bdpw01ip
bdpw02ip
bdpf01ip
bdpf02ip
bdpa01ip
bdpo01ip
bdpp01ip
bdps01ip
bdpq01ip
bdpq02ip
bdpq03ip
bdpn01ip
bdpn02ip
bdpc01ip
bdpc02ip
bdpc03ip
bdpc04ip
bdpc05ip
bdpc06ip
bdpc07ip
bdpc08ip
bdpp02ip
KSCEFGWS01P
KSCMLGWS02P
KSCMLGWS01P
rpaa01ip
KSCKMGWS01P
KSCMVGWS01P
KSCPTGWS01P
ksc_as_db1
ksc_gw_db1
KSCGWGWS01P
KSCMBGWS01P
rpad01ip
KSCDMERP01P
tmxa01iq
KSCAMSOL01P
KSCAMCON01P
KSCAMBIL01P
KSCSMERP01T
KSCCMDBE01P
KSCCMDBE03P
KSCDMPI001P
KSCDMPI002P
tmsh01ip
tmsw01ip
tmsd01ip
swaa04id
fdsc01ip
ctmc02iq
ctmc01iq
ssc_mail
SSC_QA
smca01iq
uccc01iq
WIN-LVU6CLTCM23
WIN-HBLUAJ8GAFN
WIN-I6DARRP8JPB
swaa02id
dcks02ip
ssod01ip
cpca01iq
cpcd01iq
mpsa01ip
mpsh01ip
pocapm01ip
imxp01ip
swaapm01ip
xzzp01ip
tomc01iq
wopg01ip
adsc01ip
adsc02ip
ssc_mail01
ssc_mail02
otah01ip
otah02ip
szzd03is
ssoa01ip
ssoa02ip
ovmc01ip
ovmc02ip
vmwc03ip.kscc.local
vmwc04ip.kscc.local
vmwc05ip.kscc.local
vmwc06ip.kscc.local
vmwc09ip
vmwc10ip
