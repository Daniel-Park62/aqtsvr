#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <signal.h>
#include <usrinc/atmi.h>
#include <usrinc/tmaxapi.h>
#include <error.h>
#include <errno.h>
#include <mysql.h>
#include <stdarg.h>
#include <ctype.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <linux/fcntl.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <stdint.h>

#include "aqt2.h"
#define MAXBUF 8192
static  int server_sockfd, client_sockfd;

int svr_socket(uint32_t portnum) {
    struct sockaddr_in  serveraddr;
    
    if((server_sockfd = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)) == -1) {
    	perror("socket error : ");
      return(-1);
    }
    
    memset(&serveraddr, 0, sizeof(serveraddr));
    serveraddr.sin_family = AF_INET;
    serveraddr.sin_addr.s_addr = htonl(INADDR_ANY);
    serveraddr.sin_port = htons(portnum);
    
    if ( -1 == bind(server_sockfd, (struct sockaddr *)&serveraddr, sizeof(serveraddr)) ) {
    	perror("bind error : ");
      return(-1);
    }
    if ( -1 == listen(server_sockfd, 5) ) {
    	perror("listen error : ");
      return(-1);
    }
    printf("%d port listen\n",portnum) ;

    return 0;
}

int main(int argc, char **argv) {
    socklen_t client_len, n;
    char buf[MAXBUF]; 
    char buf2[MAXBUF]; 
    struct sockaddr_in clientaddr;
    client_len = sizeof(clientaddr);

  uint32_t portnum = 9292 ;
  if ( argc > 1)  portnum = atol(argv[1]) ;
  if (-1 == svr_socket(portnum)  ) exit(-1);

    while(1) {
    	memset(buf, 0x00, MAXBUF);
    	memset(buf2, 0x00, MAXBUF);
        client_sockfd = accept(server_sockfd, (struct sockaddr *)&clientaddr, &client_len);
        printf("New Client Connect: %s\n", inet_ntoa(clientaddr.sin_addr));
        while(1) {
          if((n = read(client_sockfd, buf, MAXBUF)) <= 0) {
            break;
          }
          memmove(buf2,buf,n) ;
          printf("Read Data :(%d) %s\n",n, buf2);
          
          if(write(client_sockfd, buf2, MAXBUF) <= 0) {
            perror("write error : ");
              break;
          }
        }
        close(client_sockfd);
    }
  exit(0);
}