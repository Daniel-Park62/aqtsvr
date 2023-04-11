/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;

DELIMITER //
CREATE EVENT `ev_cnt_upd` ON SCHEDULE EVERY 1 HOUR STARTS '2021-02-01 18:07:01' ON COMPLETION PRESERVE DISABLE COMMENT '서비스별 총누적건수 업데이트' DO BEGIN

	DECLARE done INT DEFAULT FALSE;
	DECLARE VCODE VARCHAR(50) ;
	DECLARE cur CURSOR FOR SELECT TCODE FROM ttcppacket WHERE cdate > DATE_ADD(NOW(), interval 1 HOUR) ;
	
	DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  OPEN cur;

  read_loop: LOOP
    FETCH cur INTO VCODE;

    IF done THEN
      LEAVE read_loop;
    END IF;

	CALL sp_summary(vcode) ;
  END LOOP;

  CLOSE cur;
END//
DELIMITER ;

DELIMITER //
CREATE PROCEDURE `sp_copytestdata`(
	IN `src_code` VARCHAR(50),
	IN `dst_code` VARCHAR(50),
	IN `cond` VARCHAR(1000),
	IN `numbyuri` INT
)
main: BEGIN

/*
	DECLARE cnt1 INT ;
	SELECT COUNT(1) INTO cnt1 FROM ttcppacket WHERE TCODE = dst_code ;
	
	if cnt1 > 0 then
		SELECT '이전 복사작업된 데이터가 있습니다.' ;
		leave main;
	END if ;
*/	
	DECLARE v_pkey INT ;
	DECLARE v_msg_u VARCHAR(100) DEFAULT '' ;
	DECLARE v_msg VARCHAR(100) ;
	
   DECLARE exit handler for SQLEXCEPTION
    BEGIN
        ROLLBACK;        
        SELECT  CONCAT('SQL 실행중 오류발생!! ',CHAR(10),  cond) ;
        UPDATE texecjob SET resultStat = 3, msg = 'SQL 실행중 오류발생!!', enddt = NOW() WHERE pkey = v_pkey ;
    END;


	SET @NN = 0 ;
	SET @SRC = src_code ;
	SET @DST = dst_code ;
	SET @NUM = numbyuri ;
	SET @SQLT = CONCAT ( 
	' SELECT count(1) into @NN 
	FROM ttcppacket A JOIN ( SELECT CMPID FROM ttcppacket WHERE TCODE = ? ' ,cond  ,
	 ') B ON (A.CMPID = B.CMPID ) WHERE TCODE = ? ' ) ;
	 
	INSERT INTO texecjob (jobkind, tdesc, tcode,  in_file, resultStat, etc, tnum ,reqnum, startdt)
	 VALUES ( 3, '전문복제작업', @DST, @SRC,  1, cond, 1, @NUM, NOW() ) ;
	
	SELECT LAST_INSERT_ID() INTO v_pkey ;
/*	
	EXECUTE IMMEDIATE @SQLT USING @SRC, @DST  ;
	if @NN > 0 then
		SELECT '이전 복사작업된 데이터가 있습니다.' ;
		UPDATE texecjob SET resultStat = 3, msg = '이전 복사작업된 데이터가 있습니다.', enddt = NOW() WHERE pkey = v_pkey ;
		leave main;
	END if ;
*/
	UPDATE ttcppacket d, ttcppacket s SET d.rcode = 0 , d.rhead = NULL, d.errinfo = NULL ,d.slen = s.slen, d.rlen = 0, d.sdata = s.sdata, d.rdata = NULL , d.stime = s.stime, d.rtime = s.rtime, d.elapsed = 0
	WHERE d.tcode = @DST AND s.tcode = @SRC AND d.cmpid = s.cmpid ;

	IF ROW_COUNT() > 0 THEN 
		SELECT CONCAT( ROW_COUNT(), ' 건 수정되었음', CHR(13),CHR(10)) INTO v_msg_u ;
	END IF ;
	if numbyuri = 0 then
	   SET @NUM = 9999999 ;
	END if ;
	SET @SQLT = CONCAT ( 
	' INSERT into ttcppacket 
	( tcode, cmpid, o_stime, stime, rtime,  elapsed, srcip, srcport, dstip, dstport, proto, method, uri, seqno, ackno, rcode,rhead, slen, rlen, sdata )
	SELECT ? ,cmpid, o_stime, stime, rtime,  elapsed, srcip, srcport, dstip, dstport, proto, method, uri, seqno, ackno, 0, "미수행",slen, 0, sdata
	FROM ( SELECT ROW_NUMBER() OVER (PARTITION BY URI) rno, t.* FROM ttcppacket t WHERE TCODE = ? ', cond,
	       ' and not exists (select 1 from ttcppacket where tcode = ? and cmpid = t.cmpid  ) ) x 
	WHERE rno <= ? '  ) ;
	
	EXECUTE IMMEDIATE @SQLT USING @DST, @SRC, @DST, @NUM  ;

	SELECT CONCAT( v_msg_u, ROW_COUNT(), ' 건 복제되었음') INTO v_msg ;
	
	UPDATE texecjob SET resultStat = 2, msg = v_msg , enddt = NOW() WHERE pkey = v_pkey ;
	
	INSERT INTO thostmap ( tcode, thost, tport, thost2, tport2 ) 
	SELECT @DST, thost, tport, thost2, tport2 FROM thostmap s
	WHERE tcode = @SRC 
	  AND NOT EXISTS (SELECT 1 FROM thostmap WHERE tcode = @DST AND thost = s.thost AND tport = s.tport) ;
	
	SELECT v_msg ;
	
	COMMIT;
END//
DELIMITER ;

DELIMITER //
CREATE PROCEDURE `sp_insService`(
	IN `p_tcode` VARCHAR(50)
)
    COMMENT 'packet데이터로 부터 uri 가져옴'
BEGIN

update tservice s LEFT join 
(SELECT uri, appid ,COUNT(URI) cnt
 FROM vtcppacket X 
  WHERE lvl > '0' AND (uri,appid) IN (SELECT uri, appid FROM vtcppacket WHERE tcode LIKE p_tcode GROUP BY uri,appid)
 GROUP BY URI,  appid ) t
 ON (s.svcid = t.uri AND s.appid = t.appid)
SET s.cumcnt = ifnull(t.cnt,0) ;

INSERT INTO tservice (svcid, appid, svckor, svceng, svckind, task, manager, cumcnt )
SELECT uri, appid, regexp_replace(uri,'.*/','') nn,regexp_replace(uri,'.*/',''),
       '0', appid ,'', COUNT(URI)
 FROM vtcppacket X
  WHERE tcode LIKE p_tcode
  AND NOT EXISTS (SELECT 1 FROM tservice WHERE svcid = x.uri AND appid = x.appid )
 GROUP BY URI,  appid
 ORDER BY uri ;

END//
DELIMITER ;

DELIMITER //
CREATE PROCEDURE `sp_summary`(
	IN `in_tcode` VARCHAR(50)
)
    COMMENT '데이터통계수집'
BEGIN
	
	UPDATE tmaster T LEFT JOIN  (
		SELECT      tcode, count(distinct URI ) svc_cnt
		, count(distinct case when sflag = '2' then URI end ) fsvc_cnt
		, count(1) data_cnt
		, sum(case when sflag = '1' then 1 else 0 end) scnt
		, sum(case when sflag = '2' then 1 else 0 end) fcnt
		 from  ttcppacket 
		 WHERE TCODE like in_tcode 
		 GROUP BY TCODE
		) SUMM ON (t.code = summ.tcode)
	  SET T.svc_cnt = ifnull(summ.svc_cnt,0),
			T.fsvc_cnt = ifnull(summ.fsvc_cnt,0),
			T.data_cnt = ifnull(summ.data_cnt,0),
			T.scnt = ifnull(summ.scnt,0),
			T.fcnt = ifnull(summ.fcnt,0)
		WHERE t.code like in_tcode  ;
		
	UPDATE tlevel l, ( 
		SELECT lvl, COUNT(DISTINCT URI ) svc_cnt, COUNT(1)  data_cnt, SUM(if(sflag='1',1,0)) scnt
		 FROM  
		 ( SELECT ROW_NUMBER() OVER (PARTITION BY lvl,URI ORDER BY lvl,stime DESC) rno , lvl, uri, sflag from vtcppacket  WHERE lvl > '0' AND sflag > '0' ) x
		 WHERE rno < 21
		 GROUP BY LVL  
	) s
	SET l.svc_cnt  = s.svc_cnt, l.data_cnt = s.data_cnt , l.scnt = s.scnt
	WHERE l.lvl = s.lvl ;
	
	CALL sp_insService(in_tcode) ;
 
	UPDATE tservice l, ( 
		SELECT uri, uf_getapp(dstip,dstport) appid, COUNT(1 ) cnt
		 from  ttcppacket , tmaster 
		 WHERE TCODE =  CODE AND LVL > '0'
		 GROUP BY uri, uf_getapp(dstip,dstport) 
	) s
	SET l.cumcnt  = s.cnt
	WHERE l.svcid = s.uri AND l.appid = s.appid ;
   
   COMMIT;
	
END//
DELIMITER ;

DELIMITER //
CREATE PROCEDURE `sp_summtask`(
	IN `in_task` VARCHAR(50)
)
BEGIN

	DELETE FROM ttasksum  WHERE NOT EXISTS 
	 ( SELECT 1 FROM vtcppacket a JOIN tservice b ON (a.uri = b.svcid AND b.appid = a.appid )  
	   WHERE ttasksum.task = b.task AND ttasksum.lvl = a.lvl) ;
	
	INSERT INTO ttasksum ( task, lvl, svc_cnt, fsvc_cnt, data_cnt, scnt, fcnt, udate )
	 SELECT task, lvl, svc_cnt, fsvc_cnt, data_cnt, scnt, fcnt , NOW() FROM 
	 ( 		SELECT      task, lvl, count(distinct URI ) svc_cnt
		, count(distinct case when sflag = '2' then URI end ) fsvc_cnt
		, count(1) data_cnt
		, sum(case when sflag = '1' then 1 else 0 end) scnt
		, sum(case when sflag = '2' then 1 else 0 end) fcnt
		 from  vtcppacket a JOIN tservice b ON (a.uri = b.svcid AND b.appid = a.appid ) 
		 WHERE b.task like in_task
		 GROUP BY b.task, lvl
	 ) summ
	 ON DUPLICATE KEY 
	UPDATE svc_cnt = summ.svc_cnt,
			 fsvc_cnt = summ.fsvc_cnt,
			 data_cnt = summ.data_cnt,
			 scnt = summ.scnt,
			 fcnt = summ.fcnt,
			 udate = NOW()
		;
	COMMIT;

	SELECT ROW_COUNT() ;		
END//
DELIMITER ;

CREATE TABLE IF NOT EXISTS `tapphosts` (
  `pkey` int(11) NOT NULL AUTO_INCREMENT,
  `appid` varchar(50) NOT NULL,
  `thost` varchar(50) NOT NULL,
  `tport` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`pkey`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8 COMMENT='application 호스트등록';

CREATE TABLE IF NOT EXISTS `tapplication` (
  `appid` varchar(50) NOT NULL,
  `appnm` varchar(60) DEFAULT NULL,
  `manager` varchar(50) DEFAULT NULL COMMENT '담당자',
  PRIMARY KEY (`appid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='테스트대상 application';

CREATE TABLE IF NOT EXISTS `tconfig` (
  `id` int(11) NOT NULL DEFAULT 1,
  `pass1` varchar(50) DEFAULT NULL COMMENT '테스트admin passwd',
  `TCODE` varchar(20) DEFAULT NULL,
  `encval` varchar(20) DEFAULT NULL COMMENT 'default encoding',
  `proto` char(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `texecjob` (
  `pkey` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `jobkind` smallint(5) unsigned NOT NULL DEFAULT 9 COMMENT '0.패킷캡쳐 1.패킷파일import 3.패킷복제 9.테스트수행',
  `tcode` varchar(50) NOT NULL DEFAULT '',
  `tdesc` varchar(80) NOT NULL DEFAULT '' COMMENT '테스트설명',
  `tnum` smallint(5) unsigned NOT NULL DEFAULT 10 COMMENT '쓰레드 수',
  `dbskip` char(1) NOT NULL DEFAULT '0' COMMENT '1. dbupdate skip',
  `etc` varchar(256) NOT NULL DEFAULT '' COMMENT '기타 선택조건',
  `in_file` varchar(100) NOT NULL DEFAULT '' COMMENT '입력파일 or src Tcode',
  `outlogdir` varchar(50) NOT NULL DEFAULT '' COMMENT 'out로그위치',
  `tuser` varchar(50) NOT NULL DEFAULT '',
  `tdir` varchar(50) NOT NULL DEFAULT '',
  `tenv` varchar(50) NOT NULL DEFAULT '',
  `reqstartDt` datetime NOT NULL DEFAULT current_timestamp() COMMENT '작업시작요청일시',
  `exectype` smallint(5) unsigned NOT NULL DEFAULT 0 COMMENT '0.즉시실행  1.송신시간에 맞추어',
  `resultstat` smallint(5) unsigned NOT NULL DEFAULT 0 COMMENT '0. 미실행 1.수행중  2.완료 3.실행오류',
  `reqnum` smallint(5) unsigned NOT NULL DEFAULT 0 COMMENT '재요청횟수 -> (송신간격 or uri별건수)',
  `repnum` int(10) unsigned NOT NULL DEFAULT 1 COMMENT '반복횟수',
  `startDt` datetime DEFAULT NULL COMMENT '작업시작시간',
  `endDt` datetime DEFAULT NULL COMMENT '작업종료시간',
  `msg` mediumtext DEFAULT '' COMMENT '작업메세지',
  PRIMARY KEY (`pkey`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8 COMMENT='테스트작업요청\r\njobkind :\r\n0. tcode 에  etc의 정보를 이용하여 캡쳐수행\r\n1. tcode 에  infile 을 etc 조건적용하여 import\r\n3. tcode 애 infile 의 테스트 id를 복사해옴  infil -> tcode ( etc 조건적용 )\r\n9. 테스트송신';

CREATE TABLE IF NOT EXISTS `thostmap` (
  `pkey` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `tcode` varchar(50) NOT NULL DEFAULT '',
  `thost` varchar(50) DEFAULT NULL,
  `tport` int(11) unsigned DEFAULT NULL,
  `thost2` varchar(50) DEFAULT NULL,
  `tport2` int(11) unsigned DEFAULT NULL,
  PRIMARY KEY (`pkey`),
  KEY `tcode` (`tcode`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `tlevel` (
  `lvl` char(1) NOT NULL DEFAULT '0',
  `lvl_nm` varchar(50) NOT NULL DEFAULT '',
  `svc_cnt` int(10) unsigned NOT NULL DEFAULT 0,
  `data_cnt` int(10) unsigned NOT NULL DEFAULT 0 COMMENT '테스트수행건수',
  `scnt` int(10) unsigned NOT NULL DEFAULT 0 COMMENT '성공건수'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='테스트 level 단위, 통합, 실시간 ';

CREATE TABLE IF NOT EXISTS `tmaster` (
  `code` varchar(20) NOT NULL,
  `type` char(1) DEFAULT '1' COMMENT '1.배치테스트 2.실시간',
  `lvl` char(1) DEFAULT '0' COMMENT '0.ORIGIN 1.단위  2.통합테스트',
  `desc1` varchar(50) DEFAULT NULL,
  `cmpCode` varchar(20) DEFAULT NULL COMMENT '주비교테스트',
  `tdate` date DEFAULT current_timestamp() COMMENT '테스트시작일',
  `endDate` date DEFAULT NULL COMMENT '테스트종료일',
  `tdir` varchar(80) DEFAULT NULL,
  `tuser` varchar(20) DEFAULT NULL,
  `thost` varchar(50) DEFAULT NULL,
  `tport` int(10) unsigned NOT NULL DEFAULT 0,
  `tenv` varchar(50) DEFAULT NULL COMMENT '별도환경파일위치',
  `svc_cnt` int(10) unsigned DEFAULT 0,
  `fsvc_cnt` int(10) unsigned DEFAULT 0,
  `data_cnt` int(10) unsigned DEFAULT 0,
  `scnt` int(10) unsigned DEFAULT 0,
  `fcnt` int(10) unsigned DEFAULT 0,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='테스트 기본정보';

CREATE TABLE IF NOT EXISTS `tmpt` (
  `pkey` int(10) unsigned NOT NULL,
  `dat1` longblob DEFAULT NULL,
  PRIMARY KEY (`pkey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `trequest` (
  `pkey` int(10) unsigned NOT NULL,
  `cmpid` int(10) unsigned NOT NULL,
  `tcode` varchar(50) NOT NULL DEFAULT '',
  `uuid` char(32) DEFAULT '',
  `reqUser` varchar(50) NOT NULL DEFAULT '' COMMENT '요청자',
  `reqDt` timestamp NULL DEFAULT current_timestamp() COMMENT '요청일시',
  PRIMARY KEY (`pkey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='tr재전송요청';

CREATE TABLE IF NOT EXISTS `tservice` (
  `pkey` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `svcid` varchar(256) NOT NULL COMMENT '서비스id or uri',
  `appid` varchar(50) NOT NULL DEFAULT '',
  `svckor` varchar(200) DEFAULT NULL COMMENT '한글서비스명',
  `svceng` varchar(200) DEFAULT NULL COMMENT '영문서비스명',
  `svckind` char(1) DEFAULT NULL COMMENT '서비스종류',
  `task` varchar(50) DEFAULT NULL COMMENT '업무명',
  `manager` varchar(50) DEFAULT NULL COMMENT '담당자',
  `cumcnt` int(10) unsigned DEFAULT 0 COMMENT '누적건수',
  PRIMARY KEY (`pkey`) USING BTREE,
  KEY `svcapp` (`svcid`,`appid`)
) ENGINE=InnoDB AUTO_INCREMENT=514 DEFAULT CHARSET=utf8 COMMENT='서비스 id / name';

CREATE TABLE IF NOT EXISTS `ttasksum` (
  `task` varchar(50) NOT NULL,
  `lvl` char(1) NOT NULL DEFAULT '0' COMMENT '0.ORIGIN 1.단위  2.통합테스트',
  `svc_cnt` int(10) unsigned DEFAULT 0,
  `fsvc_cnt` int(10) unsigned DEFAULT 0,
  `data_cnt` int(10) unsigned DEFAULT 0,
  `scnt` int(10) unsigned DEFAULT 0,
  `fcnt` int(10) unsigned DEFAULT 0,
  `udate` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`task`,`lvl`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `ttcppacket` (
  `pkey` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `cmpid` int(10) unsigned NOT NULL DEFAULT 0,
  `tcode` varchar(50) NOT NULL,
  `o_stime` datetime(6) NOT NULL COMMENT 'org 송신시간',
  `stime` datetime(6) NOT NULL COMMENT '송신시간',
  `rtime` datetime(6) NOT NULL COMMENT '수신시간',
  `svctime` double(22,3) GENERATED ALWAYS AS (time_to_sec(`rtime`) - time_to_sec(`stime`)) VIRTUAL,
  `elapsed` double(22,3) NOT NULL DEFAULT (`rtime` - `stime`) COMMENT '소요시간',
  `srcip` varchar(30) DEFAULT NULL COMMENT '소스ip',
  `srcport` int(10) unsigned DEFAULT NULL COMMENT '소스port',
  `dstip` varchar(30) DEFAULT NULL COMMENT '목적지ip',
  `dstport` int(10) unsigned DEFAULT NULL COMMENT '목적지port',
  `proto` char(1) DEFAULT '0' COMMENT '0.tcp 1.http 2.https',
  `method` varchar(20) DEFAULT NULL COMMENT 'method',
  `uri` varchar(512) DEFAULT NULL,
  `seqno` int(10) unsigned DEFAULT NULL,
  `ackno` int(10) unsigned DEFAULT NULL,
  `rcode` int(10) unsigned DEFAULT 0 COMMENT 'return code',
  `sflag` char(1) GENERATED ALWAYS AS (if(`rcode` > 399,'2',if(`rcode` > 199,'1','0'))) VIRTUAL,
  `rhead` varchar(8192) DEFAULT NULL COMMENT 'response header',
  `errinfo` varchar(200) DEFAULT NULL,
  `slen` int(10) unsigned DEFAULT NULL COMMENT '송신데이터길이',
  `rlen` int(10) unsigned DEFAULT NULL COMMENT '수신데이터길이',
  `sdata` mediumblob DEFAULT NULL COMMENT '송신데이터',
  `rdata` mediumblob DEFAULT NULL COMMENT '수신데이터',
  `cdate` datetime(6) DEFAULT current_timestamp(6) COMMENT '생성일시',
  PRIMARY KEY (`pkey`),
  KEY `cmpid` (`cmpid`),
  KEY `tcode` (`tcode`)
) ENGINE=InnoDB AUTO_INCREMENT=57587 DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `ttransaction` (
  `pkey` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` char(32) NOT NULL COMMENT 'uuid',
  `tcode` varchar(50) NOT NULL COMMENT '테스트코드',
  `svrnm` varchar(50) DEFAULT NULL COMMENT '서버명',
  `svcid` varchar(50) DEFAULT NULL COMMENT '서비스id',
  `o_stime` datetime(6) DEFAULT NULL COMMENT 'asis송신시간',
  `stime` datetime(6) DEFAULT NULL COMMENT '송신시간',
  `rtime` datetime(6) DEFAULT NULL COMMENT '수신시간',
  `userid` varchar(20) DEFAULT NULL COMMENT '사용자id',
  `clientIp` varchar(40) DEFAULT NULL COMMENT '사용자ip',
  `dstip` varchar(40) DEFAULT NULL,
  `dstport` int(10) unsigned DEFAULT 0,
  `seqno` int(10) unsigned DEFAULT 0,
  `ackno` int(10) unsigned DEFAULT 0,
  `scrno` varchar(20) DEFAULT NULL COMMENT '화면ID',
  `msgcd` varchar(10) DEFAULT NULL COMMENT '수신메세지코드',
  `rcvmsg` varchar(120) DEFAULT NULL COMMENT '수신메세지',
  `errinfo` varchar(120) DEFAULT NULL,
  `sflag` char(1) DEFAULT NULL COMMENT '1.성공 2.실패',
  `async` char(1) DEFAULT NULL COMMENT '0.tpacall  1.tpcall',
  `svctime` double(22,3) DEFAULT (`rtime` - `stime`) COMMENT '순수서비스소요시간',
  `elapsed` double(22,3) GENERATED ALWAYS AS (time_to_sec(`rtime`) - time_to_sec(`stime`)) VIRTUAL,
  `slen` int(10) unsigned DEFAULT NULL COMMENT '송신데이터길이',
  `rlen` int(10) unsigned DEFAULT NULL COMMENT '수신데이터길이',
  `sdata` mediumblob DEFAULT NULL COMMENT '송신데이터',
  `rdata` mediumblob DEFAULT NULL COMMENT '수신데이터',
  `cdate` datetime(6) DEFAULT current_timestamp(6) COMMENT '생성시간',
  PRIMARY KEY (`pkey`),
  KEY `tcode_uuid` (`tcode`,`uuid`),
  KEY `tcode_svcid_stime` (`tcode`,`svcid`,`o_stime`)
) ENGINE=InnoDB AUTO_INCREMENT=238 DEFAULT CHARSET=utf8 COMMENT='거래데이터 ';

DELIMITER //
CREATE FUNCTION `uf_getapp`(`in_ip` VARCHAR(50),
	`in_port` INT
) RETURNS varchar(50) CHARSET utf8
BEGIN

	DECLARE V_APPID VARCHAR(50) ;
	
	SET V_APPID = '';
	
	SELECT APPID INTO V_APPID FROM tapphosts WHERE THOST = in_ip AND ( tport = in_port OR tport = 0 ) ;
	
	RETURN V_APPID ;
	
END//
DELIMITER ;

CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `vtcppacket` AS SELECT t.*, ifnull(a.appid,'') appid , m.*  FROM ttcppacket t JOIN tmaster m ON (t.tcode = m.code ) 
LEFT JOIN tapphosts a ON (t.dstip = a.thost AND (t.dstport = a.tport OR a.tport = 0)) ;

CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `vtransaction` AS SELECT t.*, ifnull(a.appid,'') appid , m.*  FROM ttransaction t JOIN tmaster m ON (t.tcode = m.code ) 
LEFT JOIN tapphosts a ON (t.dstip = a.thost AND (t.dstport = a.tport OR a.tport = 0)) ;

CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `vtrxdetail` AS SELECT 1 pkey, CAST('' as VARCHAR(20)) tcode,  CAST('' as VARCHAR(60)) svcid,  CAST('' as VARCHAR(60)) scrno,   
							CAST('' as VARCHAR(60)) svckor , 1 tcnt, 99.99 avgt , 1 scnt , 1 fcnt, 1 cumcnt ;

CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `vtrxlist` AS SELECT      t.code, `type`, t.lvl, desc1, cmpCode, tdate, endDate, tdir, tuser, thost, tport, tenv,
				ifnull(t.svc_cnt, 0) svc_cnt,
				ifnull(t.fsvc_cnt, 0) fsvc_cnt,
            ifnull(t.data_cnt, 0) data_cnt,
            ifnull(t.scnt, 0) scnt,
            ifnull(t.fcnt, 0) fcnt,
            ifnull(scnt * 100 / (scnt+fcnt) ,0.0)  spct,
            IFNULL(l.svc_cnt,0) tot_svccnt
from tmaster t left JOIN tlevel l ON (t.lvl = l.lvl) 
 ;

INSERT INTO `tconfig` (`id`, `pass1`, `TCODE`,proto) VALUES
	(1, 'testadmin', NULL, '0');

GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY 'dawinit1';

CREATE USER 'aqtdb'@'%' IDENTIFIED BY 'Dawinit1!';
GRANT EXECUTE,SELECT, DELETE, INSERT, EVENT, UPDATE, TRIGGER  ON `aqtdb2`.* TO 'aqtdb'@'%';
GRANT EXECUTE,SELECT, DELETE, INSERT, EVENT, UPDATE, TRIGGER  ON `aqtdb2`.* TO 'aqtdb'@'localhost';


/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IF(@OLD_FOREIGN_KEY_CHECKS IS NULL, 1, @OLD_FOREIGN_KEY_CHECKS) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
