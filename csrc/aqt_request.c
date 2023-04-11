/*
AQT MQ SEND request

aqt_request 숫자 -- aqt_reqsub 갯수 ( 기본값 5 )
*/

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <signal.h>
#include <libgen.h>
#include <error.h>
#include <errno.h>
#include <mysql.h>
#include <stdarg.h>
#include <ctype.h>
#include <endian.h>
#include <stdint.h>
#include <time.h>
#include <arpa/inet.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <sys/ipc.h>
#include <sys/msg.h>

#include "aqt2.h"

#define MAXLN2M 1e6

int LOGprint(FILE *, char ltype, const char *func, int, const char *, ...);

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

static struct sigaction act;

static int _mtype = 2;
static int msgid = -1 ;

static MYSQL *conn = NULL;

static unsigned int _iTotCnt = 0;

static void Closed(void);
static void _Signal_Handler(int sig);
static int connectDB();
static void closeDB();
static int _Init();
static void fork_proc(int c) ;

void _Signal_Handler(int sig)
{

  if (sig == SIGCHLD)
  {
    int state;
    waitpid(-1, &state, WNOHANG);
    return;
  }

  LOGINFO("%s SIGNAL(%d) Read:(%d) ",__FILE__, sig, _iTotCnt);

  Closed();
  exit(1);
}

int _Init()
{

  act.sa_handler = _Signal_Handler;
  sigemptyset(&act.sa_mask);
  act.sa_flags = 0;

  sigaction(SIGINT, &act, 0);
  sigaction(SIGBUS, &act, 0);
  sigaction(SIGQUIT, &act, 0);
  sigaction(SIGTERM, &act, 0);
  sigaction(SIGCHLD, &act, 0);

  LOGINFO("*******<<  START %s >>********", __FILE__);

  return (0);
}

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

int connectDB()
{
  conn = mysql_init(NULL);
  if (conn == NULL)
  {
    LOGERROR("DB init error");
    return (-1);
  }

  if ((mysql_real_connect(conn, DBHOST, DBUSER, DBPASS, DBNAME, DBPORT, DBSOCKET, 0)) == NULL)
  {
    LOGERROR("DB connect error : %s", mysql_error(conn));
    return (-1);
  }

  mysql_autocommit(conn, 1);

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
  MSGREC msg;
  int fk_cnt = 5 ;
  if (argc > 1 ) fk_cnt = atoi(argv[1]) ;
  if (fk_cnt < 1 || fk_cnt > 15 )  fk_cnt = 5 ;
  msgkey = (key_t)getpid();

  if (connectDB())
    return (1);

  if (_Init() != 0)
  {
    Closed();
    return (-1);
  }

  if ((msgid = msgget(msgkey, IPC_CREAT | 0666)) == -1)
  {
    LOGERROR("msgget failed");
    Closed();
    return (-1);
  }

  fork_proc(fk_cnt) ;

  while (1)
  {
    char query[2048] = {
        0,
    };
    strcpy(query, "SELECT pkey FROM trequest ORDER BY reqdt LIMIT 10 ");

    if (mysql_query(conn, query))
    {
      LOGERROR("query error : %s", mysql_error(conn));
      Closed();
      return (1);
    }
    MYSQL_RES *result = mysql_store_result(conn);
    if (result == NULL)
    {
      LOGERROR("result error : %s", mysql_error(conn));
      ;
      Closed();
      return (1);
    }

    MYSQL_ROW row;
    while ((row = mysql_fetch_row(result)))
    {
      unsigned long pkey = atol(row[0]);

      sprintf(query, "DELETE FROM trequest where pkey = %ld", pkey);
      if (mysql_query(conn, query))
      {
        LOGERROR("query error : %s", mysql_error(conn));
        continue;
      }

      _iTotCnt++;

      msg.msg_type = _mtype;
      msg.data.pkey = pkey;
      msg.data.dbu = 1;

      if (msgsnd(msgid, &msg, sizeof(msg.data), 0) == -1)
      {
        LOGERROR("msgsnd failed");
        break;
      }
      sleep(3) ;
    } // while loop end
    mysql_free_result(result);
    mysql_commit(conn);
  } // while(1)

  LOGINFO("** Read Count[%d]", _iTotCnt);

  LOGINFO("*** END PROG %s***",__FILE__);
  Closed();
  exit(0);
}

static void fork_proc(int c) {

  char carr[20] ;
  sprintf(carr,"-q %d",msgkey) ;
  LOGINFO(carr);
  for(int i = 0; i<c; i++) {
    if (fork() == 0) {
      execl("./aqt_reqsub","./aqt_reqsub",carr,NULL) ;
    }
  }
}

void Closed()
{
  struct msqid_ds msqstat;

  closeDB();

  if (msgid >= 0) {
    while (1)
    {
      if (-1 == msgctl(msgid, IPC_STAT, &msqstat))
      {
        LOGINFO("msgctl IPC_STAT FAILED");
        break;
      }
      if (msqstat.msg_qnum == 0)
        break;
      usleep(500);
    }
    msgctl(msgid, IPC_RMID, 0);
  }
}
