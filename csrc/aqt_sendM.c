/*
AQT recv mq & tpcall
*/
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <signal.h>
#include <libgen.h>
#include <usrinc/atmi.h>
#include <usrinc/tmaxapi.h>
#include <error.h>
#include <errno.h>
#include <mysql.h>
#include <stdarg.h>
#include <ctype.h>
#include <endian.h>
#include <stdint.h>
#include <arpa/inet.h>

#include <sys/types.h>
#include <sys/ipc.h>
#include <sys/msg.h>

#include "aqt2.h"

#define MAXLN2M 1000000

#define LOGERROR(...)                                         \
  do                                                          \
  {                                                           \
    LOGprint(stderr, 'E', __func__, __LINE__, ##__VA_ARGS__); \
  } while (0)
#define LOGINFO(...)                                          \
  do                                                          \
  {                                                           \
    LOGprint(stdout, 'I', __func__, __LINE__, ##__VA_ARGS__); \
  } while (0)

static TPSTART_T *_tpinfo;

static struct sigaction act;

static int msgid = -1;
static short _iDB = 1;
static MYSQL *conn = NULL;

static unsigned int _iTotCnt = 0;
static unsigned int _iFailCnt = 0;
static unsigned int _iUpdCnt = 0;

static char *tux_sndbuf = NULL;
static char *tux_rcvbuf = NULL;

static char oltp_name[L_TR_CODE + 1];
static char _test_code[VNAME_SZ];
static char _conn_label[VNAME_SZ];
static int _mtype = 2;

static void Closed(void);
static void _Signal_Handler(int sig);
static struct timespec *getStrdate(char *, const int);
static int connectDB();
static void closeDB();
static int _Init(int, char **);
static int update_db(unsigned long, char *, long rlen, char *stime, char *rtime, double gap);
static int update_db_fail(unsigned long, char *, long, char *stime, char *rtime, char *, double gap);

static int init_context(char *conn_label);

static int LOGprint(FILE *fp_log, char ltype, const char *func, int line_no, const char *fmt, ...)
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

void _Signal_Handler(int sig)
{
  sigfillset(&act.sa_mask);
  LOGINFO("%s SIGNAL(%d) [%s] read[%d] OK[%d] Fail[%d]",__FILE__, sig, _conn_label, _iTotCnt, _iUpdCnt, _iFailCnt);
  Closed();
  exit(1);
}

int _Init(int argc, char *argv[])
{
  int opt;
  memset(_test_code, 0, sizeof(_test_code));
  memset(_conn_label, 0, sizeof(_conn_label));

  while ((opt = getopt(argc, argv, "hdm:q:")) != -1)
  {
    switch (opt)
    {
    case 'm':
      strcpy(_conn_label, optarg);
      break;
    case 'd':
      _iDB = 0;
      break;
    case 'q':
      msgkey = atol(optarg);
      break;
    case '?':
      LOGINFO("%c invalid option !!", optopt);
      return (-1);
    default:
      return (-1);
    }
  }

  act.sa_handler = _Signal_Handler;
  sigemptyset(&act.sa_mask);
  act.sa_flags = 0;
  sigaction(SIGINT, &act, 0);
  sigaction(SIGBUS, &act, 0);
  sigaction(SIGQUIT, &act, 0);
  sigaction(SIGTERM, &act, 0);

  LOGINFO("** %s START TPCALL  [%s][%d]",__FILE__, _conn_label,msgkey);

  return (0);
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

int connectDB()
{
  conn = mysql_init(NULL);
  if (conn == NULL)
  {
    LOGERROR("mysql init error");
    return (-1);
  }

  if ((mysql_real_connect(conn, DBHOST, DBUSER, DBPASS, DBNAME, DBPORT, DBSOCKET, 0)) == NULL)
  {
    LOGERROR("DB connect error : %s", mysql_error(conn));
    return (-1);
  }

  mysql_autocommit(conn, 0);

  return (0);
}

void closeDB()
{
  if (conn)
    mysql_close(conn);
  conn = NULL;
}

int main(int argc, char *argv[])
{
  char errinfo[121];
  char c_sttime[21];
  char c_ettime[21];
  int tret;
  long rlen;

  struct timespec stv, etv;

  if (_Init(argc, argv) != 0)
  {
    return (-1);
  }

  if (connectDB())
  {
    return (1);
  }

  if ((init_context(_conn_label)) != 0)
  {
    Closed();
    return (-1);
  }

  if ((tux_sndbuf = (char *)tpalloc("CARRAY", NULL, MAXLN2M)) == NULL)
  {
    LOGERROR("sendbuf alloc failed[%s]", tpstrerror(tperrno));
    Closed();
    return (-1);
  }

  if ((tux_rcvbuf = (char *)tpalloc("CARRAY", NULL, MAXLN2M)) == NULL)
  {
    LOGERROR("rcvbuf alloc failed[%s]", tpstrerror(tperrno));
    Closed();
    return (-1);
  }

  MSGREC msg;
  // LOGINFO("%ld<-mkey", msgkey) ;
  if ((msgid = msgget(msgkey, IPC_CREAT | 0666)) == -1)
  {
    LOGINFO("msgget failed");
    exit(0);
  }

  char query[2048] = {
      0,
  };
  MYSQL_RES *result;
  MYSQL_ROW row;

  while (1)
  {
    if (msgrcv(msgid, &msg, sizeof(msg.data), _mtype, 0) == -1)
    {
      LOGINFO("msgrcv failed");
      break;
    }
    _iTotCnt++;

    _iDB = msg.data.dbu;

    sprintf(query, "SELECT pkey, uri, slen, sdata "
                   " FROM ttcppacket "
                   " WHERE pkey = %ld ",
            msg.data.pkey);

    if (mysql_real_query(conn, query, strlen(query)))
    {
      LOGERROR("mysql error : %s", mysql_error(conn));
    }

    result = mysql_store_result(conn);

    if (result == NULL)
    {
      LOGERROR("mysql error : %s", mysql_error(conn));
    }
    if (mysql_num_rows(result) <= 0)
      continue;

    row = mysql_fetch_row(result);

    mysql_free_result(result);

    //    LOGINFO("%d : (%ld)(%d)", getpid(), msg.data.pkey, msg.data.dbu) ;
    //	continue ;

    double dgap = 1.1;
    long slen = 0;
    unsigned long pkey = atoi(row[0]);
    memset(c_sttime, 0, sizeof(c_sttime));
    memset(c_ettime, 0, sizeof(c_ettime));
    slen = atoi(row[2]);

    memset(oltp_name, 0, sizeof(oltp_name));
    strncpy(oltp_name, row[1], sizeof(oltp_name));

    rlen = 0;

    stv = *getStrdate(c_sttime, 20);
    /*
        if (( tret = tpsetctxt(ctx1,0)) < 0) {
          LOGERROR("tpsetctxt Error : (%d)-[%s]", tperrno, tpstrerror(tperrno));
          break ;
        }

      chg_buff((TR_REC *)tux_sndbuf, (TR_REC *)row[3], slen) ;
     */

    strcpy(tux_sndbuf, row[3]);
    slen = strlen((char *)tux_sndbuf);
    tret = tpcall(oltp_name, (char *)tux_sndbuf, slen, (char **)&tux_rcvbuf, (long *)&rlen, TPNOFLAGS);

    etv = *getStrdate(c_ettime, 20);
    dgap = (double)(etv.tv_nsec - stv.tv_nsec) / 1e9 + (etv.tv_sec - stv.tv_sec);
    if (tret == -1)
    {
      memset(errinfo, 0, sizeof(errinfo));
      snprintf(errinfo, sizeof(errinfo) - 1, "(%d)%s", tperrno, tpstrerror(tperrno));
      if (rlen < 9)
      {
        LOGERROR("tpcall fail %d (id:%ld)(slen:%ld) %s %s", _iTotCnt, pkey, slen, oltp_name, errinfo);
      }
      if (tperrno == 28)
        init_context(_conn_label);
      if (_iDB)
        update_db_fail(pkey, (char *)tux_rcvbuf, rlen, c_sttime, c_ettime, errinfo, dgap);
    }
    else
    {
      if (_iDB)
        update_db(pkey, (char *)tux_rcvbuf, rlen, c_sttime, c_ettime, dgap);
    }

  } // while loop end

  LOGINFO("%s LOOP END",__FILE__);

  Closed();
  exit(0);
}

int init_context(char *conn_label)
{
  if (tmaxreadenv(TP_ENV_FILE, conn_label) < 0)
  {
    LOGERROR("readenv Error : (%s:%s) (%d)-(%s)", TP_ENV_FILE, conn_label, tperrno, tpstrerror(tperrno));
    return (1);
  }

  if (tpstart(NULL) < 0)
  {
    LOGERROR("tp start Error : (%s) (%d)-(%s)", conn_label, tperrno, tpstrerror(tperrno));
    return (1);
  }
  /*
    if ( tpgetctxt(ctx,TPNOFLAGS) < 0){
      LOGERROR("tp getctxt Error : (%s) (%d)-(%s)", conn_label, tperrno, tpstrerror(tperrno)) ;
      return(1);
    }
   */
  return 0;
}

void Closed()
{
  // if ( msgid > 0 ) msgctl(msgid, IPC_RMID,NULL) ;
  if (tux_rcvbuf)
    tpfree((char *)tux_rcvbuf);
  if (tux_sndbuf)
    tpfree((char *)tux_sndbuf);
  if (_tpinfo)
    tpfree((char *)_tpinfo);

  tpend();
  closeDB();
}

static int update_db(unsigned long pkey, char *rcvdata, long rlen, char *stime, char *rtime, double gap)
{

  char cbuf[MAXLN2M + MAXLN2M / 2];
  char cquery[MAXLN2M + MAXLN2M / 2];
  long ilen;

  memset(cquery, 0, sizeof(cquery));
  memset(cbuf, 0, sizeof(cbuf));

  if (rlen > 8)
  {
    ilen = (rlen > MAXLN2M ? MAXLN2M : rlen);
    mysql_real_escape_string(conn, cbuf, rcvdata, ilen);
  }

  ilen = snprintf(cquery, MAXLN2M + MAXLN2M / 2,
                  "UPDATE ttcppacket SET rdata = '%s' "
                  ", stime = STR_TO_DATE('%s', '%%Y%%m%%d%%H%%i%%S%%f')"
                  ", rtime = STR_TO_DATE('%s', '%%Y%%m%%d%%H%%i%%S%%f')"
                  ", elapsed=%.6f, rlen=%ld"
                  ", rcode=1, errinfo=null "
                  " WHERE pkey=%ld LIMIT 1",
                  cbuf, stime, rtime, gap, rlen, pkey);

  if (mysql_real_query(conn, cquery, ilen))
  {
    LOGERROR("UPDATE error (id:%ld)[%d]%s", pkey, mysql_errno(conn), mysql_error(conn));

    ilen = snprintf(cquery, MAXLN2M,
                    "UPDATE ttcppacket SET rdata = '%s' "
                    ", stime = STR_TO_DATE('%s', '%%Y%%m%%d%%H%%i%%S%%f')"
                    ", rtime = STR_TO_DATE('%s', '%%Y%%m%%d%%H%%i%%S%%f')"
                    ", elapsed=%.6f, rlen=%ld"
                    ", rcode=998, errinfo=null "
                    " WHERE pkey=%ld LIMIT 1",
                    mysql_error(conn), stime, rtime, gap, rlen, pkey);

    if (mysql_errno(conn) == 2006 || mysql_errno(conn) == 1156 || mysql_errno(conn) == 1064)
      mariadb_reconnect(conn);
  }
  else
  {
    _iUpdCnt++;
  }
  mysql_commit(conn);
  return (0);
}

static int update_db_fail(unsigned long pkey, char *rcvdata, long rlen, char *stime, char *rtime, char *errinfo, double gap)
{
  char cquery[MAXLN2M + MAXLN2M / 2];
  char cbuf[MAXLN2M + MAXLN2M / 2];
  long ilen;

  memset(cquery, 0, sizeof(cquery));
  memset(cbuf, 0, sizeof(cbuf));

  _iFailCnt++;

  if (rlen > 0)
  {
    ilen = (rlen > MAXLN2M ? MAXLN2M : rlen);
    mysql_real_escape_string(conn, cbuf, rcvdata, ilen);
  }

  ilen = snprintf(cquery, MAXLN2M + MAXLN2M / 2,
                  "UPDATE ttcppacket SET "
                  "  stime = STR_TO_DATE('%s', '%%Y%%m%%d%%H%%i%%S%%f')"
                  ", rtime = STR_TO_DATE('%s', '%%Y%%m%%d%%H%%i%%S%%f')"
                  ", elapsed=%.6f, rlen=%ld"
                  ", errinfo='%s', rcode= if(%ld > 8,1,999) "
                  ", rdata='%s' "
                  " WHERE pkey=%ld LIMIT 1",
                  stime, rtime, gap, rlen, errinfo, rlen, cbuf, pkey);

  if (mysql_real_query(conn, cquery, ilen))
  {
    LOGERROR("DB error (id:%ld)[%d]%s", pkey, mysql_errno(conn), mysql_error(conn));
    return (1);
  }
  mysql_commit(conn);
  return (0);
}
