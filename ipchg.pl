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
  $0 [-n] [-c dir]
  -n : No update
  -c dir : Dir to save orginal source
END
;
}

my %ipNhost=map{my($a,$b) = split(/\s+/,$_); $a => $b} <DATA> ;

=cut
print join(",", keys %ipNhost),"\n" ;
print join(",", values %ipNhost),"\n" ;
=cut


my %opts=();
getopts("nc:",\%opts) or Usage() ;

my $reg = qr!\b(10|172|192)(?:\.\d{1,3}){3}\b!x ;
$reg = join("|",keys %ipNhost) ;
$reg = qr!\b($reg)\b!x ;

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
  my $CHGCMT = ($fname =~ /\.(c|cc|pc|cpp|h)$/ ) ? "//TOBE:" : "# TOBE:" ;
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
    $ytext[$i] =~ s!(//|--).*$!!mg ;
  }
  foreach my $i (0..$#otext) {
    my @fwarr = ();
    while ($otext[$i] !~ m!//TOBE:! && $ytext[$i] =~ /$reg/xg) {
      my $fword = $& ;
      push @fwarr,$fword ;

      if ($ipNhost{$fword}) {
        $otext[$i] =~ s!$fword!$ipNhost{$fword}! ;
      } else{
        $otext[$i] =~ s!$fword!0.0.0.0! ;
      }
      $sw = 1  unless ($opts{n});

      if (0 < @fwarr) {
        $otext[$i] =~ s!$!${CHGCMT} @fwarr!  ; # unless ( $opts{n}) ;
        print "$fname : $otext[$i]" ;
      }
      $mcnt += $otext[$i] =~ s/\r//s if ($fname =~ /\.(c|cc|pc)$/) ;
    }
  }
  if ($mcnt) {
    printf "$fname : CR(%d) Changed.\n",$mcnt ;
    $sw = 1  unless ( $opts{n}) ;
  }
  if ($fname =~ /\.(c|cc|pc)$/  && $otext[$#otext] !~ /\n/s ) {
    $otext[$#otext] .= "\n" ;
    $sw = 1  unless ( $opts{n}) ;
    print "$fname : Last NewLine\n" ;
  }
  close $FD;
  if ( $sw ){
    copy_origin($fname) if ($opts{c}) ;
    open(my $FWD,">",$fname) || print STDERR "$? $fname\n"  && return ;
    print $FWD @otext ;
  }
}

my @infiles = map {glob} @ARGV if (@ARGV > 0) ;

foreach my $fl ( @infiles)
{
  next unless -f $fl ;
  chomp($fl);
  print STDERR "$fl\n" ;
  next if ( -B $fl) ;
  file_anal($fl) ;
}

__DATA__
10.227.107.101  10.111.11.101
