use strict;
use warnings;

use IO::Socket::INET;
# auto-flush on socket
$| = 1;
my $hostv = $ARGV[0];
my $portv = $ARGV[1];
my $continue = 1;
$SIG{INT} = sub { $continue = 0 };


while ($continue) {
    my $timestamp = localtime(time);
    my $msg = "dawinICT 10000se - $timestamp";

    # Create a connecting socket
    my $socket = new IO::Socket::INET (
        PeerHost => $hostv,
        PeerPort => $portv,
        Proto => 'tcp',
    );

    if($socket) {
      my $data ;
        my $size = $socket->send($msg);
        print "Sent!\n";
        $socket->recv($data, 1024);
        print "Recv: $data\n";
        $socket->close();
    }

    sleep 3;
}