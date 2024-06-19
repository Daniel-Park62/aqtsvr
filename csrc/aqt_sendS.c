/*
AQT MQ SEND
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

static int _iDB = 1;
static int _lvl = 1;
static int _iTimeChk = 0;
static int _mtype = 2;
static MYSQL *conn = NULL;
static int msgid = -1;

static unsigned int _interval = 0;

static unsigned int _iTotCnt = 0;
static unsigned int _repnum = 0;
static unsigned int _procnum = 3;
static unsigned long execkey = 0;

static char _test_code[VNAME_SZ];
static char _conn_label[VNAME_SZ];
static char _test_oltp[L_TR_CODE + 1];
static char cond_svcid[VNAME_SZ];
static char cond_limit[VNAME_SZ];
static char cond_etc[1024];

static void Usage(void);
static void print_status(void);
static void Closed(int);
static void _Signal_Handler(int sig);
static int connectDB();
static void closeDB();
static int _Init(int, char **);
static int get_target(char *);

void Usage(void)
{
  printf(
      "\n Usage : " __FILE__ " -t 테스트코드 [-p proc수] [-u 처리건수][-d][-k][-o 서비스] [-e 기타조건]\n"
      "\t -u : 입력건수만큼 처리(100:100건처리  10,20:11번째부터 20건처리)\n"
      "\t -d : DB 기록안함\n"
      "\t -i : 송신간격(밀리초)\n"
      "\t -k : 기존과 같은시간에 송신\n"
      "\t -e : '기타조건'\n");
}

void _Signal_Handler(int sig)
{
  if (sig == SIGCHLD)
  {
    int state;
    waitpid(-1, &state, WNOHANG);
    return;
  }

  LOGINFO("%s SIGNAL(%d) [%s] Read:(%d) ", __FILE__, sig, _test_code, _iTotCnt);
  Closed(1);
  exit(1);
}

static void fork_proc(int c)
{

  char carr1[50], carr2[50];
  char cexec[50];

  sprintf(carr1, "-q%d", msgkey) ;
  if (_lvl == '3')
  {
    strcpy(cexec, "./aqt_sendM2");
    sprintf(carr2, "-t%s", _test_code);
  }
  else
  {
    strcpy(cexec, "./aqt_sendM");
    sprintf(carr2, "-m%s", _conn_label);
  }
  LOGINFO("%s %s %s", cexec, carr1,carr2);

  for (int i = 0; i < c; i++)
  {
    if (fork() == 0)
    {
      closeDB();
      execl(cexec, cexec, carr1, carr2, NULL);
    }
  }
}

int _Init(int argc, char *argv[])
{
  int opt;
  memset(_test_code, 0, sizeof(_test_code));
  memset(_conn_label, 0, sizeof(_conn_label));
  memset(_test_oltp, 0, sizeof(_test_oltp));
  memset(cond_svcid, 0, sizeof(cond_svcid));
  memset(cond_limit, 0, sizeof(cond_limit));
  memset(cond_etc, 0, sizeof(cond_etc));

  while ((opt = getopt(argc, argv, "dhki:e:t:o:u:r:p:x:")) != -1)
  {
    switch (opt)
    {
    case 'o':
      strcpy(_test_oltp, optarg);
      snprintf(cond_svcid, VNAME_SZ, "and a.uri rlike '%s' ", _test_oltp);
      break;
    case 'e':
      snprintf(cond_etc, VNAME_SZ, "and (%s) ", optarg);
      break;
    case 'u':
      snprintf(cond_limit, VNAME_SZ, "LIMIT %s", optarg);
      break;
    case 'i':
      _interval = atoi(optarg);
      break;
    case 't':
      strcpy(_test_code, optarg);
      break;
    case 'p':
      _procnum = atoi(optarg);
      break;
    case 'd':
      _iDB = 0;
      break;
    case 'k':
      _iTimeChk = 1;
      break;
    case 'r':
      _repnum = atoi(optarg);
      break;
    case 'x':
      execkey = atol(optarg);
      break;
    case '?':
      LOGERROR("%c Invalid option.", optopt);
      Usage();
      break;
    default:
      Usage();
      return (-1);
    }
  }

  if (_test_code[0] == 0)
    return (1);

  if (get_target(_test_code))
    return (1);

  msgkey = getpid() ;

  act.sa_handler = _Signal_Handler;
  sigemptyset(&act.sa_mask);
  act.sa_flags = 0;

  sigaction(SIGINT, &act, 0);
  sigaction(SIGBUS, &act, 0);
  sigaction(SIGQUIT, &act, 0);
  sigaction(SIGTERM, &act, 0);
  sigaction(SIGCHLD, &act, 0);

  LOGINFO("*******<<  START READ TEST >>*************");
  LOGINFO("** %s TEST-ID [%s][%s]", __FILE__, _test_code, _conn_label);
  LOGINFO("******************************************");

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

int get_target(char *test_code)
{
  int ret = 0;
  char cquery[1000];
  memset(cquery, 0, sizeof(cquery));
  snprintf(cquery, sizeof(cquery),
           "SELECT a.thost, a.cmpcode, a.lvl FROM tmaster a WHERE a.code = '%s'", test_code);

  if (mysql_query(conn, cquery))
  {
    LOGERROR("query error : %s", mysql_error(conn));
    return (1);
  }

  MYSQL_RES *result = mysql_store_result(conn);
  if (result == NULL)
    return (-1);
  MYSQL_ROW row = mysql_fetch_row(result);
  if (row == NULL )
  {
    LOGERROR("** 테스트코드를 확인하세요.(%s)", test_code);
    ret = -1;
  }
  else
  {
    unsigned long *len = mysql_fetch_lengths(result);
    if (len[0] == 0) {
      LOGERROR("** 테스트대상서버 정보를 확인하세요.(%s)", test_code);
      ret = -1;
    }
    memmove(_conn_label, row[0], len[0]);

    _lvl = row[2][0];
    if (_lvl == '3')
      _mtype = 3;
  }

  mysql_free_result(result);

  return (ret);
}

int main(int argc, char *argv[])
{
  char c_sttime[21];
  char c_ettime[21];

  MSGREC msg;

  if (connectDB())
  {
    return (1);
  }

  if (_Init(argc, argv) != 0)
  {
    Usage();
    Closed(1);
    return (-1);
  }

  if ((msgid = msgget(msgkey, IPC_CREAT | 0666)) == -1)
  {
    LOGERROR("msgget failed");
    Closed(1);
    return (-1);
  }

  fork_proc(_procnum);

  char query[2048] = {
      0,
  };
  snprintf(query, 2000, "SELECT %s, DATE_FORMAT(ifnull(t.o_stime,now()) ,'%%H%%i%%s'), UNIX_TIMESTAMP(o_stime) "
                        " FROM ttcppacket t USE INDEX(tcode) join tservice s on (t.uri = s.svcid and s.appid = t.appid) "
                        " WHERE t.tcode = '%s'  %s %s ORDER BY %s %s ",
           (_mtype == 3 ? "t.cmpid" : "t.pkey"),
           _test_code, cond_svcid, cond_etc, (_test_code[0] == 'Z' ? "rand()" : "t.o_stime"), cond_limit);
  LOGINFO("%s", query);

  if (mysql_real_query(conn, query, strlen(query)))
  {
    LOGERROR("query error : %s", mysql_error(conn));

    Closed(1);
    return (1);
  }
  MYSQL_RES *result = mysql_store_result(conn);
  if (result == NULL)
  {
    LOGERROR("result error : %s", mysql_error(conn));
    ;
    Closed(1);
    return (1);
  }

  MYSQL_ROW row;
  double sv_time = (double)time(NULL);
  double cc_time = 0.0;
  long lwt;
REPEAT:
  while ((row = mysql_fetch_row(result)))
  {
    unsigned long pkey = atol(row[0]);
    memset(c_sttime, 0, sizeof(c_sttime));
    memset(c_ettime, 0, sizeof(c_ettime));

    cc_time = strtod(row[2], NULL);
    if (_iTimeChk && _iTotCnt && sv_time < cc_time)
    {
      lwt = (long)((cc_time - sv_time) * 1e6);
      if (lwt > (60 * 1e6))
        lwt = (60 * 1e6);
      usleep(lwt);
    }
    sv_time = cc_time;
    _iTotCnt++;

    msg.msg_type = _mtype;
    msg.data.pkey = pkey;
    msg.data.dbu = _iDB;

    if (msgsnd(msgid, &msg, sizeof(msg.data), 0) == -1)
    {
      LOGERROR("msgsnd failed");
      break;
    }

    if (_iTotCnt % 100 == 0)
      print_status();

    if (_interval && _iTimeChk == 0)
      usleep(_interval * 1000);

  } // while loop end
  if (_repnum > 1)
  {
    _repnum--;
    LOGINFO("Repeat %d", _repnum);
    mysql_data_seek(result, 0);
    goto REPEAT;
  }

  mysql_free_result(result);
  print_status();
  LOGINFO("%s LOOP END",__FILE__);

  Closed(0);
  exit(0);
}

void print_status()
{
  LOGINFO("**[%s] Read Count[%d]", _test_code, _iTotCnt);
}

void Closed(int x)
{
  if (msgid >= 0)
  {
    struct msqid_ds msqstat;
    do
    {
      if (-1 == msgctl(msgid, IPC_STAT, &msqstat))
      {
        LOGINFO("msgctl IPC_STAT FAILED");
        break;
      }
      if (msqstat.msg_qnum == 0 || x == 1)
        break;
      usleep(500);
    } while (1);
    msgctl(msgid, IPC_RMID, 0);
  }
  if (execkey > 0)
  {
    char query[2048] ;
    LOGINFO("** UPDATE texecjob [%ld], Count[%d] **", execkey, _iTotCnt);
    sprintf(query, "UPDATE texecjob SET msg=concat('count:',format(%d,0)), resultstat=2, endDt=NOW() WHERE pkey=%ld", _iTotCnt, execkey);

    if (mysql_real_query(conn, query, strlen(query)))
    {
      LOGERROR("update texecjob error: %s ", mysql_error(conn));
    }
  }

  closeDB();
  LOGINFO("*** END PROG %s ***", __FILE__);

}
