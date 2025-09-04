
CREATE DATABASE IF NOT EXISTS `aqtdb` ;
USE `aqtdb`;

GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY 'dawinit1';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost' IDENTIFIED BY 'dawinit1';

CREATE OR REPLACE USER 'aqtusr'@'%' IDENTIFIED BY 'Dawinit1!';
CREATE OR REPLACE USER 'aqtusr'@'localhost' IDENTIFIED BY 'Dawinit1!';
GRANT EXECUTE,SELECT, DELETE, INSERT, CREATE VIEW, EVENT, UPDATE, TRIGGER ,alter ON `aqtdb`.* TO 'aqtusr'@'%';
GRANT EXECUTE,SELECT, DELETE, INSERT, CREATE VIEW, EVENT, UPDATE, TRIGGER,alter  ON `aqtdb`.* TO 'aqtusr'@'localhost';
grant file on *.* to 'aqtusr'@'localhost';
grant file on *.* to 'aqtusr'@'%';

flush PRIVILEGES ;

CREATE TABLE IF NOT EXISTS `tconfig` (
  `id` int(11) NOT NULL DEFAULT 1,
  `pass1` varchar(50) DEFAULT NULL COMMENT '테스트admin passwd',
  `TCODE` varchar(20) DEFAULT NULL,
  `encval` varchar(20) DEFAULT NULL COMMENT 'default encoding',
  `proto` char(1) DEFAULT '0' ,
  `compr` char(1) DEFAULT '0' COMMENT '1.압축',
  `diffc` varchar(200) DEFAULT 'AND (a.rcode <> b.rcode or a.rcode > 399 or b.rcode > 399)',
  `pjtnm` VARCHAR(200) ,
  `COL1` VARCHAR(50) ,
  `COL2` VARCHAR(50) ,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB ;

INSERT INTO `tconfig` (`id`, `pass1`, `TCODE`,proto,encval, pjtnm) VALUES
	(1, 'testadmin', NULL, '0','MS949', '리눅스설치 maria');

DELIMITER //
CREATE EVENT `ev_cnt_upd` ON SCHEDULE EVERY 1 HOUR STARTS '2021-02-01 18:07:01' ON COMPLETION PRESERVE DISABLE COMMENT '서비스별 총누적건수 업데이트' DO BEGIN

	DECLARE done INT DEFAULT FALSE;
	DECLARE VCODE VARCHAR(50) ;
	DECLARE cur CURSOR FOR SELECT TCODE FROM texecjob WHERE startdt > DATE_ADD(NOW(), INTERVAL -1 day) ;
	
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
		  get diagnostics condition 1
                @rs = RETURNED_SQLSTATE , @mt = MESSAGE_TEXT;

        SELECT  CONCAT('SQL 실행중 오류발생!! ',@mt, CHAR(10),  cond) ;
        UPDATE texecjob SET resultStat = 3, msg = 'SQL 실행중 오류발생!!', enddt = NOW() WHERE pkey = v_pkey ;
    END;


	SET @NN = 0 ;
	SET @SRC = src_code ;
	SET @DST = dst_code ;
	SET @NUM = numbyuri ;
	 
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
	UPDATE ttcppacket d, ttcppacket s SET d.rcode = 0 , d.rhead = NULL, d.errinfo = NULL ,d.slen = s.slen, d.rlen = 0, d.sdata = s.sdata, d.rdata = NULL , d.stime = s.stime, d.rtime = s.rtime, d.elapsed = 0
	WHERE d.tcode = @DST AND s.tcode = @SRC AND d.cmpid = s.cmpid ;

	IF ROW_COUNT() > 0 THEN 
		SELECT CONCAT( ROW_COUNT(), ' 건 수정되었음', CHR(13),CHR(10)) INTO v_msg_u ;
	END IF ;
*/

	if numbyuri = 0 then
	   SET @NUM = 9999999 ;
	END if ;
	SET @SQLT = CONCAT ( 
	' INSERT into ttcppacket 
	( tcode, cmpid, o_stime, stime, rtime,  elapsed, srcip, srcport, dstip, dstport, proto, method, uri, seqno, ackno, rcode,rhead, slen, rlen, sdata, rdata ,errinfo)
	SELECT ? ,cmpid, o_stime, stime, rtime,  elapsed, srcip, srcport, dstip, dstport, proto, method, uri, seqno, ackno, 0, "미수행",slen, 0, sdata, rdata, errinfo
	FROM ( SELECT ROW_NUMBER() OVER (PARTITION BY URI) rno, t.* FROM ttcppacket t WHERE TCODE = ? ', cond,
	       '  ) x 
	WHERE not exists (select 1 from ttcppacket where tcode = ? and cmpid = x.cmpid  ) and rno <= ? '  ) ;
	
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
CREATE PROCEDURE `sp_loaddata`(
	IN `p_src` VARCHAR(50),
	IN `p_dst` VARCHAR(50),
	IN `p_cond` VARCHAR(500)
)
COMMENT ''
BEGIN

DECLARE v_msg VARCHAR(100) ;

SELECT appid INTO @vappid FROM tmaster WHERE CODE = p_dst ;

SET @SQLT = CONCAT ( '
							INSERT INTO ttcppacket ( tcode, cmpid,appid, o_stime, stime, rtime, elapsed, srcip, srcport, dstip, dstport, proto, method, 
											 uri, seqno, ackno, slen, rlen, sdata, rdata, errinfo	,rhead	) 
							SELECT \'', p_dst,'\', t.pkey ,\'', @vappid, '\', o_stime, stime, rtime, elapsed, srcip, srcport, dstip, dstport, proto, method, 
											 uri, seqno, ackno, slen, rlen, sdata, rdata, errinfo	,rhead FROM TLOADDATA t  WHERE '
		, if (p_src = '%' ,'true', CONCAT('TCODE = \'',p_src,'\'') ) , p_cond );
		

EXECUTE IMMEDIATE @SQLT   ;

SELECT CONCAT( format(ROW_COUNT(),0), ' 건 복제되었음:', p_dst ) INTO v_msg ;
/*	
	INSERT INTO texecjob (jobkind, tdesc, tcode,  in_file, resultStat, etc, tnum ,reqnum, startdt, enddt, msg)
	 VALUES ( 3, '전문생성작업', p_dst, p_src,  2, p_cond, 1, p_ecnt, cdate,NOW(), v_msg ) ;
*/	 
	 SELECT v_msg ;
	
END//
DELIMITER ;

DELIMITER //
CREATE PROCEDURE `sp_loaddata2`(
	IN `p_src` VARCHAR(50),
	IN `p_dst` VARCHAR(50),
	IN `p_cond` VARCHAR(500),
	IN `p_ecnt` INT
)
BEGIN

DECLARE v_msg VARCHAR(100) ;
DECLARE icnt INT DEFAULT 0;
DECLARE done INT DEFAULT FALSE ;
DECLARE cdate DATETIME DEFAULT NOW();
DECLARE s_uri TYPE of tloaddata.uri DEFAULT '';


DECLARE cur1 CURSOR FOR
	SELECT uri FROM tloaddata where tcode like p_src GROUP BY uri ;
	
DECLARE cur2 CURSOR FOR 
	SELECT pkey, o_stime, rtime, elapsed, srcip, srcport, dstip, dstport, proto, method, 
			seqno, ackno, slen, rlen, sdata, rdata, errinfo,rhead, appid
	 FROM vtloaddata t
	WHERE uri = s_uri
	  AND NOT EXISTS (SELECT 1 FROM ttcppacket WHERE tcode = p_dst AND cmpid = t.pkey)
	ORDER BY o_stime desc
	LIMIT p_ecnt ;

	
DECLARE CONTINUE HANDLER FOR NOT FOUND SET done := TRUE ;

SET @SQLT = CONCAT ( 
	'create or REPLACE VIEW VTLOADDATA AS
	  SELECT t.*,B.APPID APPID FROM TLOADDATA t , tmaster B WHERE '
	  , if (p_src = '%' ,'true', CONCAT('TCODE = \'',p_src,'\'') ) 
	  , CONCAT('b.CODE = \'',p_dst,'\'')  
	  , p_cond ) ; 

/*
	  SELECT t.*,IFNULL(B.APPID,\'\') APPID FROM TLOADDATA t LEFT JOIN tapphosts B ON (T.DSTIP = B.THOST AND (T.DSTPORT = B.tport OR B.tport = 0)) WHERE ',
	   if (p_src = '%' ,'true', CONCAT('TCODE = \'',p_src,'\'') ) , p_cond ) ; 
*/
-- SELECT @SQLT ;
EXECUTE IMMEDIATE @SQLT   ;

if (p_ecnt = 0) then set p_ecnt = 9999999;  END if ;

OPEN cur1 ;

readuri: LOOP
	FETCH cur1 INTO s_uri ;
	if done then leave readuri ; 	END if ;
	if (p_ecnt > 0 and (SELECT COUNT(1) FROM ttcppacket WHERE tcode = p_dst AND uri = s_uri) >= p_ecnt ) then ITERATE readuri; END if ;
	
	OPEN cur2 ;
	BEGIN 
		DECLARE vrec ROW TYPE of cur2 ;
		insloop: LOOP
			fetch cur2 INTO vrec ;
			if done then leave insloop ; END if ;
			INSERT INTO ttcppacket ( tcode, cmpid, appid, o_stime, stime, rtime, elapsed, srcip, srcport, dstip, dstport, proto, method, 
											 uri, seqno, ackno, slen, rlen, sdata, rdata, errinfo	,rhead	)
								VALUES (p_dst, vrec.pkey, vrec.appid, vrec.o_stime, vrec.o_stime, vrec.rtime, vrec.elapsed, vrec.srcip, vrec.srcport, 
									vrec.dstip, vrec.dstport, vrec.proto, vrec.method, 
									s_uri, vrec.seqno, vrec.ackno, vrec.slen, vrec.rlen, vrec.sdata, vrec.rdata, vrec.errinfo	,vrec.rhead	) ;
			SET icnt = icnt + 1;
		END loop ;
	END;
	close cur2;
	SET done := FALSE ;
	
END LOOP ;
		
close cur1 ;


SELECT CONCAT( format(icnt,0), ' 건 복제되었음:', p_dst ) INTO v_msg ;
/*	
	INSERT INTO texecjob (jobkind, tdesc, tcode,  in_file, resultStat, etc, tnum ,reqnum, startdt, enddt, msg)
	 VALUES ( 3, '전문생성작업', p_dst, p_src,  2, p_cond, 1, p_ecnt, cdate,NOW(), v_msg ) ;
*/	 
	 SELECT v_msg ;
	
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
   COMMIT;
		
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
		SELECT uri, t.appid, COUNT(1 ) cnt
		 from  ttcppacket t , tmaster m
		 WHERE TCODE =  CODE AND LVL > '0'
		 GROUP BY uri, t.appid 
	) s
	SET l.cumcnt  = s.cnt
	WHERE l.svcid = s.uri AND l.appid = s.appid ;
   
   
   COMMIT;
	
END//
DELIMITER ;

DELIMITER //
CREATE OR REPLACE PROCEDURE `sp_summtask`(
	IN `in_task` VARCHAR(50)
)
BEGIN

	DELETE FROM ttasksum  WHERE NOT EXISTS 
	 ( SELECT 1 FROM vtcppacket a JOIN tservice b ON (a.uri = b.svcid AND b.appid = a.appid )  
	   WHERE ttasksum.task = b.task AND ttasksum.lvl = a.lvl) ;
	
	INSERT INTO ttasksum ( task, lvl, svc_cnt, fsvc_cnt, data_cnt, scnt, fcnt, udate )
	 SELECT APPID, lvl, svc_cnt, fsvc_cnt, data_cnt, scnt, fcnt , NOW() FROM 
	 ( 		SELECT      APPID, lvl, count(distinct URI ) svc_cnt
		, count(distinct case when sflag = '2' then URI end ) fsvc_cnt
		, count(1) data_cnt
		, sum(case when sflag = '1' then 1 else 0 end) scnt
		, sum(case when sflag = '2' then 1 else 0 end) fcnt
		 from  vtcppacket  
		 WHERE APPID like in_task
		 GROUP BY APPID, lvl
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

CREATE TABLE `taqtuser` (
	`pkey` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
	`Host` VARCHAR(50) NOT NULL ,
	`usrid` VARCHAR(50) NOT NULL ,
	`usrdesc` VARCHAR(100) NOT NULL COMMENT '사용자설명' ,
	`pass1` VARCHAR(50) NOT NULL DEFAULT password('aqtuser') ,
	`admin` INT(10) UNSIGNED NOT NULL DEFAULT '0' COMMENT '테스트관리자 1',
	`apps` VARCHAR(100) NOT NULL DEFAULT '' ,
	`lastin` DATETIME NOT NULL DEFAULT current_timestamp(),
	`lcnt` INT(11) NOT NULL DEFAULT '0',
	`regdt` DATETIME NOT NULL DEFAULT current_timestamp(),
	PRIMARY KEY (`pkey`) USING BTREE
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB;

INSERT INTO taqtuser
	(Host, usrid, usrdesc, pass1, admin, apps)
	VALUES ('%', 'testadmin', 'AQT admin', password('aqtadmin'), 1, '.*') ;
	
CREATE TABLE IF NOT EXISTS `tapphosts` (
  `pkey` int(11) NOT NULL AUTO_INCREMENT,
  `appid` varchar(50) NOT NULL,
  `thost` varchar(50) NOT NULL,
  `tport` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`pkey`)
) ENGINE=InnoDB COMMENT='application 호스트등록';

CREATE TABLE IF NOT EXISTS `tapplication` (
  `appid` varchar(50) NOT NULL,
  `appnm` varchar(60) DEFAULT NULL,
  `manager` varchar(50) DEFAULT NULL COMMENT '담당자',
  `gubun` TINYINT(4) NULL DEFAULT 0,
  `scnt` INT(10) UNSIGNED NULL DEFAULT '0' COMMENT '대상서비스수',
  PRIMARY KEY (`appid`)
) ENGINE=InnoDB  COMMENT='테스트대상 application';

INSERT INTO tapplication (appid, appnm, manager ) VALUES('AP01','기본','AQT') ;

CREATE TABLE IF NOT EXISTS  `texecjob` (
	`pkey` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
	`jobkind` SMALLINT(5) UNSIGNED NOT NULL DEFAULT '9' COMMENT '0.패킷캡쳐 1.패킷파일import 3.패킷복제 9.테스트수행',
	`tcode` VARCHAR(50) NOT NULL DEFAULT '' COLLATE 'utf8_general_ci',
	`tdesc` VARCHAR(80) NOT NULL DEFAULT '' COMMENT '테스트설명' COLLATE 'utf8_general_ci',
	`tnum` SMALLINT(5) UNSIGNED NOT NULL DEFAULT '10' COMMENT '쓰레드 수',
	`dbskip` CHAR(1) NOT NULL DEFAULT '0' COMMENT '1. dbupdate skip' COLLATE 'utf8_general_ci',
	`etc` VARCHAR(256) NOT NULL DEFAULT '' COMMENT '기타 선택조건' COLLATE 'utf8_general_ci',
	`in_file` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '입력파일 or src Tcode' COLLATE 'utf8_general_ci',
	`limits` VARCHAR(30) NOT NULL DEFAULT '' COMMENT '처리건수 ( 예: 1,10 )' COLLATE 'utf8_general_ci',
	`cmdl` VARCHAR(256) NOT NULL DEFAULT '' COMMENT '수행명령' COLLATE 'utf8_general_ci',
	`tuser` VARCHAR(50) NOT NULL DEFAULT '' COLLATE 'utf8_general_ci',
	`tdir` VARCHAR(50) NOT NULL DEFAULT '' COLLATE 'utf8_general_ci',
	`tenv` VARCHAR(50) NOT NULL DEFAULT '' COLLATE 'utf8_general_ci',
	`thost` VARCHAR(50) NOT NULL DEFAULT '' COLLATE 'utf8_general_ci',
	`tport` INT(10) UNSIGNED NOT NULL DEFAULT '0',
	`reqstartDt` DATETIME NOT NULL DEFAULT current_timestamp() COMMENT '작업시작요청일시',
	`exectype` SMALLINT(5) UNSIGNED NOT NULL DEFAULT '0' COMMENT '0.즉시실행  1.송신시간에 맞추어',
	`resultstat` SMALLINT(5) UNSIGNED NOT NULL DEFAULT '0' COMMENT '0. 미실행 1.수행중  2.완료 3.실행오류',
	`reqnum` SMALLINT(5) UNSIGNED NOT NULL DEFAULT '0' COMMENT '재요청횟수 -> (송신간격 or uri별건수)',
	`repnum` INT(10) UNSIGNED NOT NULL DEFAULT '1' COMMENT '반복횟수',
	`tcnt` INT(10) UNSIGNED NOT NULL DEFAULT '0' COMMENT '대상건수',
	`ccnt` INT(10) UNSIGNED NOT NULL DEFAULT '0' COMMENT '처리건수',
	`ecnt` INT(10) UNSIGNED NOT NULL DEFAULT '0' COMMENT '오류건수',
	`startDt` DATETIME NULL DEFAULT NULL COMMENT '작업시작시간',
	`endDt` DATETIME NULL DEFAULT NULL COMMENT '작업종료시간',
	`msg` MEDIUMTEXT NULL DEFAULT '' COMMENT '작업메세지' COLLATE 'utf8_general_ci',
	PRIMARY KEY (`pkey`) USING BTREE
)
COMMENT='테스트작업요청\r\njobkind :\r\n0. tcode 에  etc의 정보를 이용하여 캡쳐수행\r\n1. tcode 에  infile 을 etc 조건적용하여 import\r\n3. tcode 애 infile 의 테스트 id를 복사해옴  infil -> tcode ( etc 조건적용 )\r\n9. 테스트송신'
COLLATE='utf8_general_ci'
ENGINE=InnoDB;

CREATE TABLE `texecing` (
	`pkey` INT(10) UNSIGNED NOT NULL COMMENT 'jobid',
	`tcnt` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '총건수',
	`ccnt` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '처리건수',
	`ecnt` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '오류건수',
	PRIMARY KEY (`pkey`) USING HASH
) ENGINE=MEMORY ;

CREATE TABLE IF NOT EXISTS `thostmap` (
  `pkey` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `tcode` varchar(50) NOT NULL DEFAULT '',
  `thost` varchar(50) DEFAULT NULL,
  `tport` int(11) unsigned DEFAULT NULL,
  `thost2` varchar(50) DEFAULT NULL,
  `tport2` int(11) unsigned DEFAULT NULL,
  PRIMARY KEY (`pkey`),
  KEY `tcode` (`tcode`) USING BTREE
) ENGINE=InnoDB ;

CREATE TABLE IF NOT EXISTS `tlevel` (
  `lvl` char(1) NOT NULL DEFAULT '0',
  `lvl_nm` varchar(50) NOT NULL DEFAULT '',
  `svc_cnt` int(10) unsigned NOT NULL DEFAULT 0,
  `data_cnt` int(10) unsigned NOT NULL DEFAULT 0 COMMENT '테스트수행건수',
  `scnt` int(10) unsigned NOT NULL DEFAULT 0 COMMENT '성공건수',
  PRIMARY KEY (`lvl`) USING BTREE
) ENGINE=InnoDB COMMENT='테스트 level 단위, 통합, 실시간 ';

INSERT INTO tlevel (lvl,lvl_nm) values('1','단위'),('2','통합'),('3','정합성') ;

CREATE TABLE IF NOT EXISTS `tloaddata` (
  `pkey` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `tcode` varchar(50) NOT NULL,
  `o_stime` datetime(6) NOT NULL COMMENT 'org 송신시간',
  `stime` datetime(6) NOT NULL COMMENT '송신시간',
  `rtime` datetime(6) NOT NULL COMMENT '수신시간',
  `elapsed` double(22,3) NOT NULL DEFAULT (time_to_sec(`rtime`) - time_to_sec(`stime`)) COMMENT '소요시간',
  `svctime` double(22,3) GENERATED ALWAYS AS (time_to_sec(`rtime`) - time_to_sec(`stime`)) VIRTUAL,
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
  `sflag` char(1) GENERATED ALWAYS AS (if(`rcode` > 399,'2',if(`rcode` = 0,'0','1'))) VIRTUAL,
  `rhead` varchar(8192) DEFAULT NULL COMMENT 'response header',
  `errinfo` varchar(200) DEFAULT NULL,
  `slen` int(10) unsigned DEFAULT NULL COMMENT '송신데이터길이',
  `rlen` int(10) unsigned DEFAULT NULL COMMENT '수신데이터길이',
  `sdata` mediumblob DEFAULT NULL COMMENT '송신데이터',
  `rdata` mediumblob DEFAULT NULL COMMENT '수신데이터',
  `cdate` datetime(6) DEFAULT current_timestamp(6) COMMENT '생성일시',
  PRIMARY KEY (`pkey`) USING BTREE,
  KEY `tcode` (`tcode`,`o_stime`) USING BTREE,
  KEY `uri` (`uri`,`o_stime`)
) ENGINE=InnoDB ;

CREATE TABLE IF NOT EXISTS `tmaster` (
  `code` varchar(20) NOT NULL,
  `type` char(1) DEFAULT '1' COMMENT '1.배치테스트 2.실시간',
  `lvl` char(1) DEFAULT '0' COMMENT '0.ORIGIN 1.단위  2.통합테스트 3.정합성',
  `desc1` varchar(50) DEFAULT NULL,
  `cmpCode` varchar(20) DEFAULT NULL COMMENT '주비교테스트',
  `tdate` date DEFAULT current_timestamp() COMMENT '테스트시작일',
  `endDate` date DEFAULT NULL COMMENT '테스트종료일',
  `tdir` varchar(80) DEFAULT NULL,
  `tuser` varchar(20) DEFAULT NULL,
  `appid` VARCHAR(50) NULL DEFAULT '',
  `thost` varchar(50) DEFAULT NULL,
  `tport` int(10) unsigned NOT NULL DEFAULT 0,
  `tenv` varchar(100) DEFAULT NULL COMMENT '별도환경파일위치',
  `pro` char(1) DEFAULT '0',
  `svc_cnt` int(10) unsigned DEFAULT 0,
  `fsvc_cnt` int(10) unsigned DEFAULT 0,
  `data_cnt` int(10) unsigned DEFAULT 0,
  `scnt` int(10) unsigned DEFAULT 0,
  `fcnt` int(10) unsigned DEFAULT 0,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB COMMENT='테스트 기본정보';

CREATE TABLE IF NOT EXISTS `trequest` (
  `pkey` int(10) unsigned NOT NULL,
  `cmpid` int(10) unsigned NOT NULL,
  `tcode` varchar(50) NOT NULL DEFAULT '',
  `uuid` VARCHAR(512) DEFAULT null,
  `reqUser` varchar(50) NOT NULL DEFAULT '' COMMENT '요청자',
  `reqDt` timestamp NULL DEFAULT current_timestamp() COMMENT '요청일시',
  PRIMARY KEY (`pkey`)
) ENGINE=MEMORY COMMENT='tr재전송요청';

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
) ENGINE=InnoDB COMMENT='서비스 id / name';

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
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `ttcppacket` (
  `pkey` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `cmpid` int(10) unsigned NOT NULL DEFAULT 0,
  `tcode` varchar(50) NOT NULL,
  `appid` VARCHAR(50) NOT NULL DEFAULT '',
  `o_stime` datetime(6) NOT NULL COMMENT 'org 송신시간',
  `stime` datetime(6) NOT NULL COMMENT '송신시간',
  `rtime` datetime(6) NOT NULL COMMENT '수신시간',
  `svctime` double(22,3) GENERATED ALWAYS AS (time_to_sec(`rtime`) - time_to_sec(`stime`)) VIRTUAL,
  `elapsed` double(22,3) NOT NULL DEFAULT (time_to_sec(`rtime`) - time_to_sec(`stime`)) COMMENT '소요시간',
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
  `col1` VARCHAR(100)  AS (cast('' as char(100) )) virtual ,
  `col2` VARCHAR(100)  AS (cast('' as char(100) )) virtual ,

  PRIMARY KEY (`pkey`),
  KEY `cmpid` (`cmpid`),
  KEY `tcode` (`tcode`,`o_stime`) USING BTREE
) ENGINE=InnoDB ;

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

CREATE or replace  VIEW `vtcppacket` AS SELECT t.*, 
   m.type, lvl, desc1, cmpCode, tdate, endDate, tdir, tuser, thost, tport, tenv, pro, svc_cnt, fsvc_cnt, data_cnt, scnt, fcnt
FROM ttcppacket t JOIN tmaster m ON (t.tcode = m.code )  ;

CREATE  VIEW `vtrxdetail` AS SELECT 1 pkey, CAST('' as VARCHAR(20)) tcode,  CAST('' as VARCHAR(60)) svcid,  CAST('' as VARCHAR(60)) scrno,   
							CAST('' as VARCHAR(60)) svckor , 1 tcnt, 99.99 avgt , 1 scnt , 1 fcnt, 1 cumcnt ;

CREATE or replace VIEW `vtrxlist` AS SELECT      t.code, `type`, t.lvl, desc1, cmpCode, tdate, endDate, tdir, tuser, thost, tport, tenv, appid,
				ifnull(t.svc_cnt, 0) svc_cnt,
				ifnull(t.fsvc_cnt, 0) fsvc_cnt,
            ifnull(t.data_cnt, 0) data_cnt,
            ifnull(t.scnt, 0) scnt,
            ifnull(t.fcnt, 0) fcnt,
            IFNULL(t.scnt * 100 / (t.scnt+t.fcnt) ,0.0)  spct,
            IFNULL(l.svc_cnt,0) tot_svccnt
from tmaster t left JOIN tlevel l ON (t.lvl = l.lvl) ;

