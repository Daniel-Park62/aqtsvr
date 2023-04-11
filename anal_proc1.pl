#!/usr/bin/perl
# proc 컴파일 결과 분석
use strict;
use warnings;
use File::Basename;

sub file_anal {
  my $fname = shift || return ;
  open (my $FD,"<",$fname) || print STDERR "$? $fname\n" && return ;
  local $/='execenc';
  print "start !\n";
  while(my $stext = <$FD>){
    $stext =~ s/\r//gs;
    $stext =~ /iname=(.+?)\s/s;
    next unless $1;
    my $dirn = dirname($1);
    if (length($dirn) <= 1) {
      next if ($1 eq 'sddsjhsdjh') ;
      $dirn = dirname(`ls /shs/prod/??/$1 2>/dev/null | head -1`);
      unless($dirn){
        print $1,"\n";
        next;
      }
    }
    my $pgnm = basename($1);
    while($stext =~ m![Ee]rror at line (\d+), column (\d+).*?\n(.*?)(?=Error at)!sg) {
      my ($ln,$cl,$ny)  = ($1,$2,$3) ;
      while ($ny =~ m!\s*(.*?)(?:\n\.+).*?PLS-S-.*?, (?<ny>.*)\n!smg)
      {
        my ($n1,$n2) = ($1,$+{ny}) ;
        next if ($n2 =~ /^Statement ignored/) ;
        $n1 =~ s/[\r\n]//;
        $n2 =~ s/[\r\n]/@^/g;
        $n1 =~ s/\t/ /g;
        $n2 =~ s/\t/ /g;
        print "$dirn\t$pgnm\t$ln\t$cl\t$n1\t$n2\n"
      }
    }
  }
  close $FD;
}

my @infiles = map {glob} @ARGV if (@ARGV > 0) ;

foreach my $fl ( @infiles)
{
  next unless -f $fl ;
  chomp($fl);
  print STDERR "$fl\n" ;
  file_anal($fl) ;
}