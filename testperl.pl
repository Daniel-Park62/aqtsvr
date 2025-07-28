
use File::Find;
sub flread{
  return if -d;
  print "[$File::Find::dir][$File::Find::name][$_]\n";
}

print "\n *input-> ($ARGV[0])  ($ARGV[1])\n";
find(sub {
  return if -d;
  return unless /$ARGV[1]/;
  print "[$File::Find::dir][$File::Find::name][$_]\n";
} , $ARGV[0]);
=pod
$ss = 'aaa  @@ bbb 222';
my @keysv =();
#my %ipNhost=map {my($a,$b) = split(/\s+/,$_); if ($a =~ /\S+/) {push @keysv, $a ; $a => $b}  }  $ss;
my %ipNhost= map{ s/^\s+// ;my($a,$b) = split(/\s+/,$_); if ($a =~ /\S+/) {push(@keysv, $a) ; $a => $b} } split("@@",$ss);

foreach my $k1 (@keysv) { print "$k1 \n";}
foreach $k (keys(%ipNhost)) { print"[$k] $ipNhost{$k}\n" ;}