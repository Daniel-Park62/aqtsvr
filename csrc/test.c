#include <stdlib.h>
#include <stdio.h>
#include <time.h>
#include <string.h>
#include <ctype.h>

#define MemCopy(D, S, N)                  \
	do                                      \
	{          \
                int i = (N)-1 ;                             \
		while ( i >= 0 && isblank(*((S) + i))  ) \
			*((D) + i-- ) = 0;                     \
		memcpy((D), (S), i + 1);            \
	} while (0)

int main() {
  static struct timespec tv;
  struct tm tm1;

  clock_gettime(CLOCK_REALTIME, &tv);
  localtime_r(&tv.tv_sec, &tm1);
  char cdate[21] ;
  char *x = "10.227.107.101" ;
  char y[20] ;
  MemCopy(y,x,9) ;
  strftime(cdate,21,"%Y%m%d",&tm1) ;
  printf("(%s)(%s)(%s)\n", x,y,cdate);
}
