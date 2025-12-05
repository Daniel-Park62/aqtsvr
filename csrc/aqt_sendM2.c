/*
AQT recv mq 
multi context
*/

#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <string.h>
#include <signal.h>
#include <libgen.h>
#ifdef __TMAX__
 #include <usrinc/atmi.h>
 #include <usrinc/tmaxapi.h>
#else
 #include <atmi.h>
#endif
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

static TPSTART_T *_tpinfo ;

static struct sigaction act ;

static int msgid = -1;

static int _iDB = 1;
static MYSQL *conn = NULL ;
static int ctx1, ctx2 ;

static unsigned int _iTotCnt = 0 ;
static unsigned int _iFailCnt = 0 ;
static unsigned int _iErrCnt = 0 ;
static unsigned int _iUpdCnt = 0 ;

static char *tux_sndbuf = NULL;
static char *tux_rcvbuf1 = NULL;
static char *tux_rcvbuf2 = NULL;

static char oltp_name[L_TR_CODE+1] ;
static char _tcode1[VNAME_SZ];
static char _tcode2[VNAME_SZ];
static char _conn_label1[VNAME_SZ];
static char _conn_label2[VNAME_SZ];
static int _mtype = 3 ;

static void Closed(void) ;
static void _Signal_Handler(int sig) ;
static int connectDB(void) ;
static void closeDB(void) ;
static int _Init(int, char **) ;
static int update_db( unsigned long, char*,long,char*,char*,double) ;
static int update_db_fail( unsigned long, char*,long,char*,char*,char*, double) ;

static int init_context(char *conn_label ); 
static void *svc_call(void*) ;

void _Signal_Handler(int sig)
{
	sigfillset(&act.sa_mask) ;
	LOGINFO("SIGNAL(%d) -> [%s] Read:(%d) Ok:(%d) Fail:(%d)",sig, _tcode1, _iTotCnt, _iUpdCnt, _iFailCnt );
	Closed();
	exit(1);
}

int _Init(int argc, char *argv[])
{
  int opt;
  memset(_tcode1, 0, sizeof(_tcode1)) ;

  while((opt = getopt(argc, argv, "hdt:q:")) != -1) {
    switch (opt) {
      case 't':
        strcpy(_tcode1,optarg) ;
        break;
      case 'd':
        _iDB = 0;
        break;
      case 'p':
        _mtype = atol(optarg) ;
        break;
      case 'q':
        msgkey = atol(optarg) ;
        break;
	  case '?':
		LOGINFO("%c invalid option !",optopt ) ;
		return(1);
      default:
        return(-1);
    }
  }
  

  act.sa_handler = _Signal_Handler ;
  sigemptyset(&act.sa_mask);
  act.sa_flags = 0;
  sigaction(SIGINT, &act, 0);
  sigaction(SIGBUS, &act, 0);
  sigaction(SIGQUIT, &act, 0);
  sigaction(SIGTERM, &act, 0);

  LOGINFO("******<< %s START TPCALL [%s][%d] >>********",__FILE__, _tcode1, msgkey);

  return(0) ;
}

int connectDB()
{
  conn = mysql_init(NULL) ;
  if ( conn == NULL) {
    LOGERROR("mysql init error");
    return(-1);
  }

  if ( (mysql_real_connect(conn, DBHOST, DBUSER, DBPASS, DBNAME, DBPORT ,DBSOCKET ,0)) == NULL){
    LOGERROR("DB connect error : %s", mysql_error(conn));
    return(-1);
  }

  mysql_autocommit(conn,0);
  
  return(0);
}

void closeDB()
{
	if (conn) mysql_close(conn);
	conn = NULL ;
}


static char errinfo1[121];
static char c_sttime1[21];
static char c_ettime1[21];
static char errinfo2[121];
static char c_sttime2[21];
static char c_ettime2[21];
static int tret1, tret2 ;
static long rlen1, rlen2 ;

static double dgap1 = 1.1, dgap2 = 1.1 ;

static long slen = 0;

int main(int argc, char *argv[])
{
	
	pthread_attr_t attr;
	pthread_t p_th;

	struct timespec stv,etv ;

	MYSQL_RES *result;
	MYSQL_ROW row;
	char query[2048] = {0,};
	
	if (_Init(argc,argv) != 0) {
		return (-1);
	}
	
	if (connectDB()) return(1) ;
		
	snprintf(query, sizeof(query),
			"SELECT A.THOST, B.CODE, B.THOST FROM TMASTER A JOIN TMASTER B "
			"ON (A.CMPCODE = B.CODE) WHERE A.CODE = '%s'", _tcode1 ) ;
			
	if (mysql_real_query(conn,query, strlen(query))) {
		LOGERROR("query error : %s", mysql_error(conn)) ;
		return(1) ;
	}
	result = mysql_store_result(conn) ;
	
	if (result == NULL) {
		LOGERROR("query result : %s", mysql_error(conn)) ;
		return(1) ;
	}
	if (mysql_num_rows(result) <= 0) {
		LOGERROR("Not found counter Test code ");
		return(1) ;
	}

	row = mysql_fetch_row(result) ;
	snprintf(_conn_label1, sizeof(_conn_label1),"%s",row[0]) ;
	snprintf(_tcode2, sizeof(_tcode2),"%s",row[1]) ;
	snprintf(_conn_label2, sizeof(_conn_label2),"%s",row[2]) ;
	
	_tpinfo = (TPSTART_T *)tpalloc("TPSTART",NULL,0) ;
	if (_tpinfo == NULL) {
		LOGERROR("TP ALLOC error : %s", tpstrerror(tperrno)) ;
		Closed();
		return(1) ;
	}
	
	_tpinfo->flags = TPMULTICONTEXTS;
	
	if( (ctx1 = init_context(_conn_label1 )) == -1 ) {
		Closed();
		return(1);
	}
	if( (ctx2 = init_context(_conn_label2 )) == -1 ) {
		Closed();
		return(1);
	}
	
	if ((tux_sndbuf=(char *) tpalloc("CARRAY", NULL, MAXLN2M)) == NULL ) {
		LOGERROR("sendbuf alloc failed[%s]", tpstrerror(tperrno));
		Closed();
		return(-1);
	}

	if ((tux_rcvbuf1=(char *) tpalloc("CARRAY", NULL, MAXLN2M)) == NULL ) {
		LOGERROR("rcvbuf alloc failed[%s]", tpstrerror(tperrno));
		Closed();
		return(-1);
	}

	if ((tux_rcvbuf2=(char *) tpalloc("CARRAY", NULL, MAXLN2M)) == NULL ) {
		LOGERROR("rcvbuf alloc failed[%s]", tpstrerror(tperrno));
		Closed();
		return(-1);
	}
	MSGREC msg;
	
	if ( (msgid = msgget(msgkey,IPC_CREAT|0666)) == -1 ) {
		LOGERROR("msgget failed[%s]", strerror(errno));
		Closed();
		return(-1);
	}

	int s = pthread_attr_init(&attr);
	if (s != 0)
		LOGERROR("pthread_attr_init") ;
	
	if (0) {
		if (pthread_attr_setstacksize(&attr, 1024*1024*8)) 
			LOGERROR("pthread_attr_setstacksize") ;
	}
	

	while(1) {
		if (msgrcv(msgid, &msg, sizeof(msg.data),_mtype,0) == -1 ){
			LOGERROR("msgget failed[%s]", strerror(errno));
			break ;
		}
		
		_iTotCnt++ ;
		_iDB = msg.data.dbu ;
		
		snprintf(query,sizeof(query),"SELECT a.pkey, b.pkey, a.uri, a.slen, a.sdata "
				" FROM ttcppacket a join ttcppacket b on (a.cmpid = b.cmpid ) "
				" WHERE a.pkey = %ld and a.tcode = '%s' and b.tcode = '%s' " , msg.data.pkey, _tcode1, _tcode2 ) ;

		if (mysql_real_query(conn, query, strlen(query))){
			LOGERROR("query error : %s", mysql_error(conn));
			continue ;
		}

		result = mysql_store_result(conn) ;
		
		if ( mysql_num_rows(result) <= 0 ) continue ;
		
		row = mysql_fetch_row(result) ;
		
		mysql_free_result(result);
		
		unsigned long pkey1 = atol(row[0]);
		unsigned long pkey2 = atol(row[1]);
		memset(oltp_name,0,sizeof(oltp_name)) ;
		snprintf(oltp_name,sizeof(oltp_name),"%s", row[2] ) ;

		rlen1 = 0;
		rlen2 = 0;
		
		strcpy(tux_sndbuf, row[4]);
		slen = strlen((char*)tux_sndbuf) ;
		
		if ( pthread_create(&p_th,&attr, svc_call, NULL))
		{
			LOGERROR("thread create error : %s", strerror(errno));
			continue ;
		}
		
		tpsetctxt(ctx2,TPNOFLAGS) ;
		stv = *getStrdate(c_sttime2,20) ;
		tret2 = tpcall(oltp_name,(char *)tux_sndbuf,slen,(char **)&tux_rcvbuf2, (long*)&rlen2, TPNOFLAGS) ;
		etv = *getStrdate(c_ettime2,20) ;
		dgap2 = (double)(etv.tv_nsec - stv.tv_nsec) / 1e9 + (etv.tv_sec - stv.tv_sec) ;

		pthread_join(p_th,NULL) ;
		
		if (tret1 == -1) {
			LOGERROR("tpcall fail %ld (id:%ld)(%s):%s",_iTotCnt,pkey1,oltp_name,errinfo1);
			if (_iDB ) update_db_fail(pkey1,(char*) tux_rcvbuf1,rlen1,c_sttime1,c_ettime1,errinfo1,dgap1) ;
		} else{
			if (_iDB ) update_db(pkey1,(char*) tux_rcvbuf1,rlen1,c_sttime1,c_ettime1,dgap1) ;
		}
		if (tret2 == -1) {
			memset(errinfo2, 0 , sizeof(errinfo2));
			snprintf(errinfo2, sizeof(errinfo2)-1,"(%d)%s",tperrno,tpstrerror(tperrno)) ;
			LOGERROR("tpcall fail %ld (id:%ld)(%s):%s",_iTotCnt,pkey2,oltp_name,errinfo2);
			if (_iDB ) update_db_fail(pkey2,(char*) tux_rcvbuf2,rlen2,c_sttime2,c_ettime2,errinfo2,dgap2) ;
		} else{
			if (_iDB ) update_db(pkey2,(char*) tux_rcvbuf2,rlen2,c_sttime2,c_ettime2,dgap2) ;
		}

	} // while loop end

	pthread_attr_destroy(&attr) ;
	LOGINFO("LOOP END");
	Closed();
	exit(0);
}

static void *svc_call(void* arg) {
	
	struct timespec stv, etv;
	tpsetctxt(ctx1,TPNOFLAGS) ;
	stv = *getStrdate(c_sttime1,20) ;
	tret1 = tpcall(oltp_name,(char *)tux_sndbuf,slen,(char **)&tux_rcvbuf1, (long*)&rlen1, TPNOFLAGS) ;
	etv = *getStrdate(c_ettime1,20) ;
	dgap1 = (double)(etv.tv_nsec - stv.tv_nsec) / 1e9 + (etv.tv_sec - stv.tv_sec) ;
	if (tret1 == -1) {
		memset(errinfo1, 0 , sizeof(errinfo1));
		snprintf(errinfo1, sizeof(errinfo1)-1,"(%d)%s",tperrno,tpstrerror(tperrno)) ;
	} 
	return NULL;
}

int init_context(char *conn_label )
{
	int id ;
	if(tmaxreadenv(TP_ENV_FILE, conn_label) < 0 ){
		LOGERROR("readenv Error : (%s:%s) (%d)-(%s)", TP_ENV_FILE, conn_label, tperrno, tpstrerror(tperrno)) ;
		return(-1) ;
	}

	if(tpstart(_tpinfo) < 0 ){
		LOGERROR("tpstart Error : (%s) (%d)-(%s)", conn_label, tperrno, tpstrerror(tperrno)) ;
		return(-1) ;
	}

	if(tpgetctxt(&id, TPNOFLAGS) < 0 ){
		LOGERROR("tpgetctxt Error : (%s) (%d)-(%s)", conn_label, tperrno, tpstrerror(tperrno)) ;
		return(-1) ;
	}

	return id;
}

void Closed()
{
	if (tux_rcvbuf1) tpfree(tux_rcvbuf1);
	if (tux_rcvbuf2) tpfree(tux_rcvbuf2);
	if (tux_sndbuf) tpfree(tux_sndbuf);
	if (_tpinfo) tpfree((char *)_tpinfo);
	
	if ( tpsetctxt(ctx1,TPNOFLAGS) >= 0) tpend() ;
	if ( tpsetctxt(ctx2,TPNOFLAGS) >= 0) tpend() ;
	
	closeDB();
}

static int update_db( unsigned long pkey,char *rcvdata,long rlen, char *stime, char *rtime, double gap)
{
	char cbuf[MAXLN2M+MAXLN2M/2] ;
	char cquery[MAXLN2M+MAXLN2M/2] ;
	long ilen ;

	memset(cquery,0, sizeof(cquery));
	memset(cbuf,0, sizeof(cbuf));

	if (rlen > 0){
		ilen = (rlen > MAXLN2M ? MAXLN2M : rlen );
		mysql_real_escape_string(conn, cbuf, rcvdata, ilen) ;
	}
	ilen = snprintf(cquery,MAXLN2M+MAXLN2M/2,
		"UPDATE ttcppacket SET rdata = '%s' "
		", stime = STR_TO_DATE('%s', '%%Y%%m%%d%%H%%i%%S%%f')"
		", rtime = STR_TO_DATE('%s', '%%Y%%m%%d%%H%%i%%S%%f')"
		", elapsed=%.6f, rlen=%ld"
		", rcode=1, errinfo=null "
		" WHERE pkey=%ld LIMIT 1" ,
		 cbuf,stime,rtime, gap, rlen, pkey) ;

	if (mysql_real_query(conn, cquery, ilen)) {
		_iErrCnt++ ;
		LOGERROR("UPDATE error (id:%ld)[%d]%s", pkey, mysql_errno(conn), mysql_error(conn));
		if (mysql_errno(conn) == 2006 || mysql_errno(conn) == 1156 || mysql_errno(conn) == 1064 ) mariadb_reconnect(conn) ;
	} else {
		_iUpdCnt++;
	}
	mysql_commit(conn) ;

	return(0);
}

static int update_db_fail( unsigned long pkey,char *rcvdata,long rlen, char *stime, char *rtime, char *errinfo, double gap)
{
	char cbuf[MAXLN2M+MAXLN2M/2] ;
	char cquery[MAXLN2M+MAXLN2M/2] ;
	long ilen ;

	memset(cquery,0, sizeof(cquery));
	memset(cbuf,0, sizeof(cbuf));
	
	_iFailCnt++;

	if (rlen > 0){
		ilen = (rlen > MAXLN2M ? MAXLN2M : rlen );
		mysql_real_escape_string(conn, cbuf, rcvdata, ilen) ;
	}
	ilen = snprintf(cquery,MAXLN2M+MAXLN2M/2,
		"UPDATE ttcppacket SET rdata = '%s' "
		", stime = STR_TO_DATE('%s', '%%Y%%m%%d%%H%%i%%S%%f')"
		", rtime = STR_TO_DATE('%s', '%%Y%%m%%d%%H%%i%%S%%f')"
		", elapsed=%.6f, rlen=%ld"
		", rcode=999, errinfo='%s' "
		" WHERE pkey=%ld LIMIT 1" ,
		 cbuf,stime,rtime, gap, rlen, errinfo, pkey) ;

	if (mysql_real_query(conn, cquery, ilen)) {
		_iErrCnt++ ;
		LOGERROR("UPDATE error (id:%ld)[%d]%s", pkey, mysql_errno(conn), mysql_error(conn));
		if (mysql_errno(conn) == 2006 || mysql_errno(conn) == 1156 || mysql_errno(conn) == 1064 ) mariadb_reconnect(conn) ;
	} else {
		_iUpdCnt++;
	}
	mysql_commit(conn) ;

	return(0);
}
