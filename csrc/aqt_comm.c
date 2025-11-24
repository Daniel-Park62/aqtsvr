/*
AQT mq recv & tpcall
  °Çº° tpstart
*/

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <stdarg.h>
#include <time.h>
#include "aqt2.h"

int LOGprint(FILE *fp_log, char ltype, const char *func, int line_no, const char *fmt, ...)
{
  va_list ap;
  int sz = 0;
  struct timespec tv;
  struct tm tm1;
  char date_info[256];
  char src_info[256];
  char prt_info[1024];

  clock_gettime(CLOCK_REALTIME, &tv);
  localtime_r(&tv.tv_sec, &tm1);

  va_start(ap, fmt);

  snprintf(date_info, sizeof(date_info) - 1, "[%c] %04d%02d%02d:%02d%02d%02d%06ld",
           ltype, 1900 + tm1.tm_year, tm1.tm_mon + 1, tm1.tm_mday,
           tm1.tm_hour, tm1.tm_min, tm1.tm_sec, tv.tv_nsec / 1000);

  snprintf(src_info, sizeof(src_info) - 1, "%s (%d)", func, line_no);
  vsprintf(prt_info, fmt, ap);
  sz += fprintf(fp_log, "%s:%-25.25s: %s\n", date_info, src_info, prt_info);
  va_end(ap);
  fflush(fp_log);

  return sz;
}

struct timespec *getStrdate(char *str, const int len)
{
  static struct timespec tv;
  struct tm tm1; 
  char cTmp[21] = {
      0,
  };
  clock_gettime(CLOCK_REALTIME, &tv);
  localtime_r(&tv.tv_sec, &tm1);
  snprintf(cTmp, 21, "%04d%02d%02d%02d%02d%02d%06ld",
           1900 + tm1.tm_year, tm1.tm_mon + 1, tm1.tm_mday,
           tm1.tm_hour, tm1.tm_min, tm1.tm_sec, tv.tv_nsec / 1000);
  memcpy(str, cTmp, len > 21 ? 21 : len);
  return (&tv);
}
