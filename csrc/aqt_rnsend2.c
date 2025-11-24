/*
AQT TMAX TCP RCV & SEND
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
#include <sys/types.h>
#include <sys/wait.h>
#include <linux/fcntl.h>
#include <arpa/inet.h>
#include <endian.h>
#include <stdint.h>

#include "aqt2.h"

int fcntl(int __fd, int __cmd, ...);

#define PRINTF(fmt, ...)                                             \
  do                                                                 \
  {                                                                  \
    printf("%-30s:%d " fmt "\n", __func__, __LINE__, ##__VA_ARGS__); \
  } while (0)

#define EPRINTF(fmt, ...)                                                      \
  do                                                                           \
  {                                                                            \
    fprintf(stderr, "(E) %s:%d " fmt "\n", __func__, __LINE__, ##__VA_ARGS__); \
  } while (0)

#define MAX_POOL 100
static char aqthome[100] ;
static TPSTART_T *_tpinfo;

static struct sigaction act, act_old;

static FILE *fp_log = NULL;
static pid_t fpid = -1;

static int _iDB = 1;
static int _iCall = 1;
static int _iTwo = 0;
static int pfd[2] = {0, 0};
static int ctx1, ctx2;
static MYSQL *conn;
static unsigned int _iTotCnt = 0;
static unsigned int _iOkCnt = 0;
static unsigned int _iFailCnt = 0;
static unsigned int _iUpdCnt = 0;

static unsigned int _test_count = 0;

static pid_t pid;
static unsigned int childc = 1;

static char _test_code[VNAME_SZ];
static char _conn_label[VNAME_SZ];
static char _test_code2[VNAME_SZ];
static char _conn_label2[VNAME_SZ];
static char _test_date[VNAME_SZ];
static char _selsvc[VNAME_SZ];

static char sndrec[MAXLN2M];
static char *tux_sndbuf;

typedef struct
{
  char *tux_rcvbuf;
  long seqno;
  long ackno;
  long slen;
  long rlen;
  char oltp_name[L_TR_CODE + 1];
  char otime[27];
  char srcip[31];
  int srcport;
  char dstip[31];
  int dstport;
  char errinfo[121];
  char c_sttime[21];
  char c_ettime[21];
  char rec[137];
  double dgap;
} SR_ARR;

static SR_ARR sr_arr, sr_arr2;

static void Usage(void);
static void Closed(void);
static void _Signal_Handler(int sig);
static unsigned long atoi00(char *, int len);
static int connectDB();
static int _Init(int, char **);
static int get_target(char *, char *);
static int update_db(SR_ARR *, char *, int);
static int init_context(char *conn_label);

static void *svc_call();
static void tpcall_proc(void);
static void th_free();

void Usage(void)
{
  printf(
      "\n Usage : aqt_rnsend2 -a TESTID1 [-b TESTID2] [-n 건수] [-d | -s] [-o svcId] \n\n"
      "\t -a : TEST ID 1\n"
      "\t -b : TEST ID 2\n"
      "\t -n : 수헹건수\n"
      "\t -s : No tpcall \n"
      "\t -d : No Write DB \n"
      "\t -o : Service id\n\n");
}

int _Init(int argc, char *argv[])
{
  int opt;
  memset(_test_code, 0, sizeof(_test_code));
  memset(_test_code2, 0, sizeof(_test_code2));
  memset(_selsvc, 0, sizeof(_selsvc));

  while ((opt = getopt(argc, argv, "a:b:dhsn:o:")) != -1)
  {
    switch (opt)
    {
    case 'a':
      strcpy(_test_code, optarg);
      break;
    case 'b':
      strcpy(_test_code2, optarg);
      _iTwo = 1;
      break;
    case 'n':
      _test_count = atoi(optarg);
      break;
    case 'o':
      strcpy(_selsvc, optarg);
      break;
    case 'd':
      _iDB = 0;
      break;
    case 's':
      _iCall = 0;
      break;
    default:
      return (-1);
    }
  }

  if (!(_iDB || _iCall))
  {
    EPRINTF("-d , -s 동시사용할 수 없슴");
    return (-1);
  }
/* 
  if (argc <= optind)
  {
    EPRINTF("%d %d %s",argc,optind, _test_code);
    return (-1);
  }
 */
  act.sa_handler = _Signal_Handler;
  sigemptyset(&act.sa_mask);
  act.sa_flags = 0;
  sigaction(SIGINT, &act, &act_old);
  sigaction(SIGCHLD, &act, &act_old);
  sigaction(SIGPIPE, &act, 0);

  getStrdate(_test_date, 8);
  sprintf(aqthome,"%s",getenv("AQTHOME")) ;
  PRINTF("%s",aqthome) ;
  LOGINFO("***********<<  START READ TEST >>*****************");
  LOGINFO("** TEST ID  [%s][%s]", _test_code, _test_code2);
  LOGINFO("** TARGET   [%s][%s]", _conn_label, _conn_label2);
  LOGINFO("**************************************************");

  return (0);
}

void _Signal_Handler(int sig)
{
  int state;

  if (sig == SIGCHLD)
  {
    waitpid(-1, &state, WNOHANG);
    childc--;
    return;
  }

  sigaction(SIGINT, &act_old, NULL);

  th_free();
  if (fpid == getpid())
  {
    waitpid(-1, &state, WNOHANG);
    close(pfd[0]);
    kill(pid, SIGINT);
    LOGINFO("SIGNAL(%d) -> [%s] Read:(%d) ", sig, _test_code, _iTotCnt);
  }
  else
    PRINTF("SIGNAL(%d) -> [%s] Fail:(%d) DB:(%d)", sig, _test_code, _iFailCnt, _iUpdCnt);
  exit(1);
}

int connectDB()
{
  conn = mysql_init(NULL);
  if (conn == NULL)
  {
    EPRINTF("mysql init error");
    return (-1);
  }

  if ((mysql_real_connect(conn, DBHOST, DBUSER, DBPASS, DBNAME, DBPORT, DBSOCKET, 0)) == NULL)
  {
    EPRINTF("DB connect error : %s", mysql_error(conn));
    return (-1);
  }

  mysql_autocommit(conn, 1);
  return (0);
}

unsigned long atoi00(char *str, int len)
{
  char data[21];
  char *ptr;
  memset(data, 0x00, sizeof(data));
  memcpy(data, str, len);
  return (strtoul(data, &ptr, 10));
}

int get_target(char *test_code, char *conn_label)
{
  char cquery[1000];
  memset(cquery, 0, sizeof(cquery));
  snprintf(cquery, sizeof(cquery),
           "SELECT a.thost FROM tmaster a WHERE a.code = '%s'", test_code);

  if (mysql_query(conn, cquery))
  {
    LOGERROR("%s", mysql_error(conn));
    return (1);
  }

  MYSQL_RES *result = mysql_store_result(conn);
  if (result == NULL)
    return (-1);
  MYSQL_ROW row = mysql_fetch_row(result);
  if (row == NULL)
  {
    EPRINTF("** TEST ID 를 확인할 수 없습니다.(%s)", test_code);
    mysql_free_result(result);
    return (-1);
  }
  unsigned long *len = mysql_fetch_lengths(result);
  memmove(conn_label, row[0], len[0]);

  mysql_free_result(result);
  return (0);
}

void th_free()
{
  //  PRINTF("th free start");
  if (tux_sndbuf)
    tpfree((char *)tux_sndbuf);
  if (sr_arr.tux_rcvbuf)
    tpfree((char *)sr_arr.tux_rcvbuf);
  if (sr_arr2.tux_rcvbuf)
    tpfree((char *)sr_arr2.tux_rcvbuf);
  if (_tpinfo)
    tpfree((char *)_tpinfo);
  tux_sndbuf = NULL;
  sr_arr.tux_rcvbuf = NULL;
  sr_arr2.tux_rcvbuf = NULL;
  _tpinfo = NULL;
}

int th_alloc()
{
  tux_sndbuf = (char *)tpalloc("CARRAY", NULL, MAXLN2M);
  if (tux_sndbuf == NULL)
  {
    LOGERROR("sendbuf alloc failed[%s]", tpstrerror(tperrno));
    return (-1);
  }
  sr_arr.tux_rcvbuf = (char *)tpalloc("CARRAY", NULL, MAXLN2M);
  if (sr_arr.tux_rcvbuf == NULL)
  {
    LOGERROR("rcvbuf alloc failed[%s]", tpstrerror(tperrno));
    return (-1);
  }
  if (_iTwo)
  {
    sr_arr2.tux_rcvbuf = (char *)tpalloc("CARRAY", NULL, MAXLN2M);
    if (sr_arr2.tux_rcvbuf == NULL)
    {
      LOGERROR("rcvbuf alloc failed[%s]", tpstrerror(tperrno));
      return (-1);
    }
  }
  return 0;
}

int main(int argc, char *argv[])
{
  pid_t cpid;
  fpid = getpid();
  int ret;

  if (_Init(argc, argv) != 0)
  {
    Usage();
    Closed();
    return (-1);
  }

  if (pipe(pfd) == -1)
  {
    perror("create pipe error");
    Closed();
    exit(1);
  }

  if ((pid = fork()) == -1)
  {
    perror("fork error");
    Closed();
    exit(1);
  }

  if (pid == 0)
  {
    Closed();
    dup2(pfd[1], 1);
    close(pfd[0]);
    ret = execl("./aqt_child.sh", "./aqt_child.sh", _selsvc, NULL);

    if (ret == -1)
    {
      perror("execl error");
      exit(1);
    }
  }

  close(pfd[1]);

  _tpinfo = (TPSTART_T *)tpalloc("TPSTART", NULL, 0);
  if (_tpinfo == NULL)
  {
    LOGERROR("TP ALLOC Error : (%d)-[%s]", tperrno, tpstrerror(tperrno));
    Closed();
    return (1);
  }

  connectDB();
  if (_iCall)
  {
    get_target(_test_code, _conn_label);
    if (_iTwo)
      get_target(_test_code2, _conn_label2);
  }

  if (_iTwo)
    _tpinfo->flags = TPMULTICONTEXTS;

  if ((ctx1 = init_context(_conn_label)) != 0)
  {
    Closed();
    return (-1);
  }
  if (_iTwo)
    if ((ctx2 = init_context(_conn_label2)) != 0)
    {
      Closed();
      return (-1);
    }

  if (th_alloc() == -1)
  {
    Closed();
    return (1);
  }

  /*
    if( fcntl(pfd[0], F_SETPIPE_SZ, 1024 * 1024 * 2) < 0) {
      perror("set pipe buffer size failed.");
    }
  */
  char buf1[11];

  ssize_t rsz;
  char *AQTC = "~AQTD~";

  while (1)
  {
    memset(buf1, 0, 11);
    int i = 0, sw = 0;
    while (1)
    {
      i += sw;
      rsz = read(pfd[0], buf1 + i, 1);
      if (rsz < 1)
        break;
      if (buf1[i] == AQTC[i])
      {
        sw = 1;
      }
      else
      {
        sw = 0;
        buf1[0] = buf1[i];
        i = (buf1[i] == '~' ? 1 : 0);
      }
      if (i >= 5)
        break;
    }
    if (rsz < 1)
    {
      if (waitpid(pid, &ret, WNOHANG) == -1)
      {
        if (errno == 10)
          break;
      }
      usleep(1000);
      continue;
    }
    memset(sr_arr.rec, 0, sizeof(sr_arr.rec));
    memset(sr_arr.otime, 0, 27);
    rsz = read(pfd[0], sr_arr.rec, 136);

    MemCopy(sr_arr.oltp_name, sr_arr.rec, 32);
    MemCopy(sr_arr.otime, sr_arr.rec + 32, 26);
    MemCopy(sr_arr.srcip, sr_arr.rec + 58, 15);
    sr_arr.srcport = atoi00(sr_arr.rec + 73, 5);
    MemCopy(sr_arr.dstip, sr_arr.rec + 78, 15);
    sr_arr.dstport = atoi00(sr_arr.rec + 93, 5);
    sr_arr.seqno = atoi00(sr_arr.rec + 98, 15);
    sr_arr.ackno = atoi00(sr_arr.rec + 113, 15);
    sr_arr.slen = atoi00(sr_arr.rec + 128, 8);
    sndrec[sr_arr.slen] = 0;
    rsz = read(pfd[0], sndrec, sr_arr.slen);

    if (rsz < 1)
      continue;

    if (strchr(sr_arr.oltp_name, ' ') != NULL)
      continue;

    _iTotCnt++;

    if (childc > 200)
    {
      if (waitpid(-1, &ret, WNOHANG) > 0)
        childc--;
    }

    cpid = fork();

    if (cpid == 0)
    {
      tpcall_proc();
      close(pfd[0]);
      Closed();
      exit(0);
    }
    else if (cpid > 0)
    {
      childc++;
    }
    else
    {
      LOGERROR("fork error : %s ", strerror(errno));
    }

    if ((_iTotCnt % 1000) == 0)
      LOGINFO("*** read count:(%d) child:(%d) DBUpdate:(%d)", _iTotCnt, childc, _iUpdCnt);

    if (_test_count && _test_count <= _iTotCnt)
      break;
  } // while loop end

  PRINTF("LOOP END");
  sigdelset((sigset_t *)&act, SIGCHLD);
  act.sa_handler = NULL;
  sigaction(SIGCHLD, &act, NULL);
  kill(pid, SIGKILL);
  wait(NULL);
  close(pfd[0]);

  LOGINFO("[%s] Read:(%d) Ok:(%d) Fail:(%d) DB:(%d)",
          _test_code, _iTotCnt, _iOkCnt, _iFailCnt, _iUpdCnt);
  PRINTF("[%s] Read:(%d) Ok:(%d) Fail:(%d) DB:(%d)",
         _test_code, _iTotCnt, _iOkCnt, _iFailCnt, _iUpdCnt);
  Closed();
  exit(0);
}

inline void tpcall_proc(void)
{
  int tret;
  struct timespec stv, etv;
  pthread_t p_th;

  memset(sr_arr.c_sttime, 0, sizeof(sr_arr.c_sttime));
  memset(sr_arr.c_ettime, 0, sizeof(sr_arr.c_ettime));
  sr_arr.rlen = 0;

  stv = *getStrdate(sr_arr.c_sttime, 20);

  if (_iCall)
  {

    strcpy(tux_sndbuf, sndrec);
    sr_arr.slen = strlen(tux_sndbuf);

    if (_iTwo && pthread_create(&p_th, NULL, svc_call, NULL))
    {
      LOGERROR("thread create error.. [%d]", errno);
    }
    tpsetctxt(ctx1, TPNOFLAGS);
    tret = tpcall(sr_arr.oltp_name, (char *)tux_sndbuf, sr_arr.slen, (char **)&sr_arr.tux_rcvbuf, (long *)&sr_arr.rlen, TPNOFLAGS);

    etv = *getStrdate(sr_arr.c_ettime, 20);
    sr_arr.dgap = (double)(etv.tv_nsec - stv.tv_nsec) / 1e9 + (etv.tv_sec - stv.tv_sec);
    memset(sr_arr.errinfo, 0, sizeof(sr_arr.errinfo));
    if (_iTwo)
      pthread_join(p_th, NULL);

    if (tret == -1)
    {
      snprintf(sr_arr.errinfo, sizeof(sr_arr.errinfo) - 1, "(%d)%s", tperrno, tpstrerror(tperrno));
      EPRINTF("ERROR[%s]", sr_arr.errinfo);
      _iFailCnt++;
      if (_iDB)
        update_db(&sr_arr, _test_code, 999);
    }
    else
    {
      //        PRINTF("tpcall success %s time(%.6f)[%d]", sr_arr.oltp_name,sr_arr.dgap,_Thread_c ) ;
      _iOkCnt++;
      if (_iDB)
      {
        update_db(&sr_arr, _test_code, 1);
      }
    }
  }
  else
  { // if (_iCall)
    memcpy(sr_arr.c_ettime, sr_arr.c_sttime, 20);
    update_db(&sr_arr, _test_code, 0);
    // PRINTF("update db [%s]", sr_arr.oltp_name);
  }

  tpend();
}

static void *svc_call()
{
  int tret, istat;
  struct timespec stv, etv;

  tpsetctxt(ctx2, TPNOFLAGS);
  stv = *getStrdate(sr_arr2.c_sttime, 20);
  tret = tpcall(sr_arr.oltp_name, (char *)tux_sndbuf, sr_arr.slen, (char **)&sr_arr2.tux_rcvbuf, (long *)&sr_arr2.rlen, TPNOFLAGS);
  etv = *getStrdate(sr_arr2.c_ettime, 20);
  sr_arr2.dgap = (double)(etv.tv_nsec - stv.tv_nsec) / 1e9 + (etv.tv_sec - stv.tv_sec);
  if (tret == -1)
  {
    memset(sr_arr2.errinfo, 0, sizeof(sr_arr2.errinfo));
    snprintf(sr_arr2.errinfo, sizeof(sr_arr2.errinfo) - 1, "(%d)%s", tperrno, tpstrerror(tperrno));
    EPRINTF("ERROR[%s]", sr_arr2.errinfo);
    _iFailCnt++;
    istat = 999;
  }
  else
  {
    _iOkCnt++;
    istat = 1;
  }
  if (_iDB)
    update_db(&sr_arr2, _test_code2, istat);
  tpend();

  return (NULL);
}

int init_context(char *conn_label)
{
  int id;
  if (tmaxreadenv(TP_ENV_FILE, conn_label) < 0)
  {
    LOGERROR("readenv Error : (%s:%s) (%d)-(%s)", TP_ENV_FILE, conn_label, tperrno, tpstrerror(tperrno));
    return (-1);
  }

  if (tpstart(_tpinfo) < 0)
  {
    LOGERROR("tpstart Error : (%s) (%d)-(%s)", conn_label, tperrno, tpstrerror(tperrno));
    return (-1);
  }

  if (tpgetctxt(&id, TPNOFLAGS) < 0)
  {
    LOGERROR("tpgetctxt Error : (%s) (%d)-(%s)", conn_label, tperrno, tpstrerror(tperrno));
    return (-1);
  }

  return id;
}

static void Closed(void)
{
  if (fp_log && fpid == getpid())
    fclose(fp_log);
  if (conn)
    mysql_close(conn);
  conn = NULL;
  th_free();
}

inline int update_db(SR_ARR *sr, char *test_code, int rcode)
{
  char sdata[MAXLN2M + MAXLN2M / 2];
  char rdata[MAXLN2M + MAXLN2M / 2];
  char cquery[MAXLN2M + MAXLN2M / 2];
  int ilen;

  memset(cquery, 0, sizeof(cquery));

  mysql_real_escape_string(conn, sdata, (char *)sndrec, sr_arr.slen);

  if (sr->rlen > 0)
  {
    ilen = (sr->rlen > MAXLN2M ? MAXLN2M : sr->rlen);
    mysql_real_escape_string(conn, rdata, (char *)sr->tux_rcvbuf, ilen);
  }
  ilen = snprintf(cquery, MAXLN2M + MAXLN2M / 2,
                  "INSERT INTO ttcppacket (cmpid, tcode, uri ,o_stime,stime,rtime,seqno,ackno ,srcip,srcport,dstip,dstport, "
                  " errinfo, rcode, elapsed,  slen, rlen, sdata,rdata) "
                  " VALUES(%ld,'%s','%s','%s',STR_TO_DATE('%s','%%Y%%m%%d%%H%%i%%S%%f'),STR_TO_DATE('%s','%%Y%%m%%d%%H%%i%%S%%f')"
                  ", %ld,%ld,'%s',%d,'%s',%d,'%s',%d,%.6f,%ld,%ld,'%s','%s') ",
                  sr_arr.seqno, test_code, sr_arr.oltp_name, sr_arr.otime, sr->c_sttime, sr->c_ettime, sr_arr.seqno, sr_arr.ackno, sr_arr.srcip, sr_arr.srcport, sr_arr.dstip, sr_arr.dstport, sr->errinfo, rcode, sr->dgap, sr_arr.slen, sr->rlen, sdata, rdata);

  if (mysql_real_query(conn, cquery, ilen))
  {
    LOGERROR("Insert error (%s)[%d]%s [%d]", sr_arr.oltp_name, mysql_errno(conn), mysql_error(conn), ilen);
    // if (mysql_errno(conn) == 2006 || mysql_errno(conn) == 1156 || mysql_errno(conn) == 1064 ) mariadb_reconnect(conn) ;
  }
  else
  {
    _iUpdCnt++;
  }

  return (0);
}
