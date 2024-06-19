use strict;
use warnings;

use IO::Socket::INET;
# auto-flush on socket
$| = 1;


# Creating a listening socket
my $portv = $ARGV[0] ;
my $socket = new IO::Socket::INET (
    LocalHost => '0.0.0.0',
    LocalPort => $portv,
    Proto => 'tcp',
    Listen => 5,
    Reuse => 1
);
die "Cannot create socket $!\n" unless $socket;

$SIG{INT} = sub { $socket->close(); exit 0; };

while(1) {
    my $client_socket = $socket->accept();

    # Get information about a newly connected client
    my $client_address = $client_socket->peerhost();

    # Read up to 1024 characters from the connected client
    my $data = "";
    $client_socket->recv($data, 1024);
    print "$client_address - $data\n";
    $client_socket->send("ok wellcome !");
}