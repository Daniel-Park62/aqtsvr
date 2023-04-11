#!/usr/bin/perl
# aix 컴파일 결과 분석
use strict;
use warnings;
use File::Basename;

sub file_anal {
  my $fname = shift || return ;
  open (my $FD,"<",$fname) || print STDERR "$? $fname\n" && return ;
  print "start !\n";

  local $/;
  my $stext = <$FD>;
  close $FD;
  $stext =~ s/\r//gs ;
  while($stext =~ m!^\"(?<m1>[\w/.]*?\.p?c)\"(?:, line (?<m2>\d+)\.(?<m3>\d+))?.*?(?<m4>\d+\-\d+) \((?<m5>.)\)(?<m6>.*?)$!sgm ){
    my $pgm = $+{m1};
    my $ln = $+{m2} || 0;
    my $col = $+{m3} || 0;
    next if ($+{m4} =~ /1506-457|1506-472/) ;
    next if ($+{m5} eq 'I' && $+{m4} =~ /\"sql|struct sql|sqlstm|sqlcxt/s ) ;
    next if ($+{m5} eq 'I' && $+{m6} =~ /\"sql|struct sql|sqlstm|sqlcxt/s ) ;
    my $dat = join ("\t",dirname($pgm), basename($pgm), $ln,$col, $+{m4},$+{m5},$+{m6}) ;
    my $scm = ($ln) ? sprintf("sed -n '%d,+2p' %s 2>/dev/null",$ln-1, $pgm) : "" ;
    my $ny = qx($scm);
    next if ($+{m5} eq 'I' && $ny =~ /\"sql|struct sql|sqlstm|sqlcxt/s ) ;
    next if ($+{m4} =~ /1506-450/ && $ny =~ /struct sql/s ) ;

    $ny =~ s/\s*=/'=/msg ;
    $ny =~ s/\t/ /gs;
    $ny =~ s/\r\n/@^/gs;
    $ny =~ s/[\r\n]/@^/gs;
    $ny =~ s/(@^){2,}/@^/gs;
    print "$dat\t$ny\n" ;
  }
}

my @infiles = map {glob} @ARGV if (@ARGV > 0) ;

foreach my $fl ( @infiles)
{
  next unless -f $fl ;
  chomp($fl);
  print STDERR "$fl\n" ;
  file_anal($fl) ;
}