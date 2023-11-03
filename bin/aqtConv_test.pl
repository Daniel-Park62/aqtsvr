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
    return if ( -d  ) ;
    return if ( $myopts{e} && ! /$myopts{e}/ ) ;
    open(my $FI,"<:encoding(euc-kr)",$_) || print STDERR "$? $_ $NL" && return ;
#    local $/ = "log\r\n" ;

    %svcarr = () if ( $myopts{d} ) ;

    my $outf = $myopts{o}.'/'. $_ ;
    $| = 1;
    open (my $FO, ">:raw", $outf ) || die "$! $outf";

    LOOP1: while ( my $stext=<$FI>)
    {
         print $FO substr($stext,0,10), "@#@", substr($stext,10),"~AQT\n" ;

    }

    close $FO ;
    close $FI ;
    print " END $NL";
}
