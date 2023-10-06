#!/usr/bin/perl

# AQT CONVERT

#use warnings ;

use strict;
use Getopt::Std ;
use File::Spec;
use File::Find;

my ($NL, $TAB, $MAXL) = ("\n","\t", 16e3) ;

my $shead ;

$shead = "POST /proframeWeb/FLDSERVICES/TS HTTP/1.1\r\n" .
         "Content-Type: application/x-www-form-urlencoded\r\n".
         "Connection: Keep-Alive\r\n" ;

my %myopts = () ;

sub Usage {
  print STDERR <<"END" ;
    사용법 : $0 [-s oltpID] -d -o 결과dir [-n 서비스별건수] [-e fillter] input dir
        -d : 파일별서비스
        -e : 파일명 fillter
END
  exit ;
}

sub parse_arg {
  getopts("hdo:n:e:s:", \%myopts) || Usage ;
  Usage if ($myopts{h});
  if ( $myopts{n} && ( $myopts{n} !~ /^\d+$/ || $myopts{n} < 1)){
    print STDERR "-n 1 이상의 숫자를 선택하세요.\n" ;
    exit;
  }
}

sub get_date {
  my $dt = `date +"%F %R"` ;
  chomp $dt ;
  return $dt ;
}

parse_arg() ;
my $func = \&file_anal ;
my $pwd = qx(pwd);
chomp $pwd ;

my @tdir = <@ARGV> ;
if ( ! -d $tdir[0] ) {
  print SRDERR "INPUT DIR Check !\n" ;
  exit ;
}

if ( ! -d $myopts{o} ) {
  print SRDERR "OUTPUT DIR Check !\n" ;
  exit ;
}

open (my $FE,">","aqtConvert_$$.err") || die "$?" ;
my (%tdata, %svcarr) ;

print $FE "AQT CONVERTER Start job", get_date,"**$NL" ;
find( { wanted => $func }, @tdir) ;
print $FE "AQT CONVERTER End job", get_date,"**$NL" ;
close $FE ;

sub file_anal{
    chomp ;
    return if ( -d || ! /dat$/ ) ;
    return if ( $myopts{e} && ! /$myopts{e}/ ) ;
    open(my $FI,"<",$_) || print STDERR "$? $_ $NL" && return ;
    local $/ = "@@\n" ;

    %svcarr = () if ( $myopts{d} ) ;

    my $outf = $myopts{o}.'/'. $_ ;
    $| = 1;
    open (my $FO, ">", $outf ) || die "$! $outf";

    LOOP1: while ( my $stext=<$FI>)
    {
        chomp($stext) ;
        my $uuid = substr($stext,73,29) ;
      if ( substr($stext,70,1) eq 'Q' ) {
        my $slen = substr($stext,62,8) - 494;
#       if ($slen > $MAXL ) {
#               print $slen, " ssz, $uuid \n" ;
#               $slen = $MAXL ;
#       }

        my $shead2 = $shead . "Content-Length: ". $slen . "\r\n\r\n" ;
        my $sdata = substr($stext,562,$slen) ;
        my $srcip = join('.', substr($stext,106,3)+0, substr($stext,109,3)+0, substr($stext,112,3)+0, substr($stext,115,3)+0) ;

        if ($srcip !~ /\d+\.\d+\.\d+\.\d+/) {
                print $uuid," $srcip : \n" ;
        }

        my $dstip = substr($stext, 45,10) ;
        my ($trg, $frame_cnt, $or_pkg_size) = ( substr($stext,230,1) , substr($stext,231,3) , substr($stext,234,8)) ; # 전문분할, 프레임카운트, 원사이즈
        my $svcid = substr($stext,287,10) ;
        my $ctnu_tr =substr($stext,297,1);  # 연속거래 구분코드

        my $stime = substr($stext,250,17) ;      

        print $FE $uuid,$stime,$NL if (length($stime) != 17 or ! $stime =~ /2\d{3}[01][0-9][0-3][0-9]\d{9}/ ) ;
        my $trhead = substr($stext,62,466) ;

        if ( $myopts{s} && $svcid !~ $myopts{s}) {
          next LOOP1 ;
        }

        if ( $myopts{n} && $myopts{n} <= $svcarr{$svcid}){
          next LOOP1 ;
        }

        $tdata{$uuid} = join("^#@", $slen, $srcip, $dstip, $svcid, $stime, $shead2.$sdata, $trhead ) ;

      } elsif ( substr($stext,70,1) eq 'R' ) {
        my $uuid = substr($stext,73,29) ;
        if ( ! defined $tdata{$uuid} ) {
          print $FE $uuid," error Data : not Found request !$NL";
          next LOOP1;
        }

        my $svcid = substr($stext,287,10) ;
        my $rlen = substr($stext,62,8) - 494;
##      if ($rlen > $MAXL ) {
#               print $rlen, " rsz, $uuid \n" ;
#               $rlen = $MAXL ;
#       }

        my $rdata = substr($stext,562,$rlen) ;
        my $rtime = substr($stext,267,17)  ; 
        print $FE $uuid,$rtime,$NL if (length($rtime) != 17 or ! $rtime =~ /2\d{3}[01][0-9][0-3][0-9]\d{9}/ ) ;
        my $adata = join("^#@", $tdata{$uuid},$rlen ,$rtime , $rdata) ;
        my $cnt = () = ($adata =~ /\^\#\@/sg ) ;
        if ( $cnt == 9 ) {
                print $FO $adata,"~AQT\n" ;
                $svcarr{$svcid}++  if ($myopts{n}) ;
        } else {
                print $FE $uuid ," error\n" ;
        }

        delete $tdata{$uuid} ;

      }

    }

    close $FO ;
    close $FI ;
    print $_, " END $NL";
}
