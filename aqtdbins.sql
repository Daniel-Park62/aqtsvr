
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
	`pkey` INT(11) NOT NULL AUTO_INCREMENT,
	`appid` VARCHAR(50) NOT NULL COLLATE 'utf8_general_ci',
	`thost` VARCHAR(50) NOT NULL COLLATE 'utf8_general_ci',
	`tport` INT(10) UNSIGNED NOT NULL DEFAULT '0',
	PRIMARY KEY (`pkey`) USING BTREE
)
COMMENT='appid 별 host,port 정보 ( 데이터로드시 참고 )'
COLLATE='utf8_general_ci'
ENGINE=InnoDB ;

CREATE TABLE IF NOT EXISTS `tapplication` (
  `appid` varchar(50) NOT NULL,
  `appnm` varchar(60) DEFAULT NULL,
  `manager` varchar(50) DEFAULT NULL COMMENT '담당자',
  `gubun` TINYINT(4) NULL DEFAULT 0,
  `scnt` INT(10) UNSIGNED NULL DEFAULT '0' COMMENT '대상서비스수',
  PRIMARY KEY (`appid`)
) ENGINE=InnoDB  COMMENT='테스트대상 application';

INSERT INTO tapplication (appid, appnm, manager ) VALUES('AP01','기본','AQT') ;

CREATE TABLE IF NOT EXISTS `taqtprog` (
	`progno` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
	`pgb` TINYINT(1) UNSIGNED NULL DEFAULT NULL COMMENT '1. 테스트 시작 전 2.개별송신전 3.개별송신후  4.테스트 완료후',
	`pgkind` TINYINT(1) UNSIGNED NULL DEFAULT NULL COMMENT '1.JS  2. c',
	`nm` VARCHAR(50) NULL DEFAULT NULL COMMENT '프로그램명' COLLATE 'utf8_general_ci',
	`src` LONGTEXT NULL DEFAULT NULL COMMENT '소스내용' COLLATE 'utf8_general_ci',
	PRIMARY KEY (`progno`) USING BTREE
)
COMMENT='테스트 전후 수행하는 프로세스 정의'
COLLATE='utf8_general_ci'
ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `texecjob` (
	`pkey` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'job id',
	`ppkey` INT(10) UNSIGNED NOT NULL DEFAULT '0' COMMENT '선행 id',
	`jobkind` SMALLINT(5) UNSIGNED NOT NULL DEFAULT '9' COMMENT '1.패킷파일import 2.패킷캡쳐  3.패킷복제 9.테스트수행',
	`tcode` VARCHAR(50) NOT NULL DEFAULT '' COLLATE 'utf8_general_ci',
	`tdesc` VARCHAR(80) NOT NULL DEFAULT '' COMMENT '테스트설명' COLLATE 'utf8_general_ci',
	`tnum` SMALLINT(5) UNSIGNED NOT NULL DEFAULT '10' COMMENT '쓰레드 수',
	`dbskip` CHAR(1) NOT NULL DEFAULT '0' COMMENT '1. dbupdate skip' COLLATE 'utf8_general_ci',
	`etc` VARCHAR(2500) NOT NULL DEFAULT '' COMMENT '기타 선택조건' COLLATE 'utf8_general_ci',
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
	`resultstat` SMALLINT(5) UNSIGNED NOT NULL DEFAULT '0' COMMENT '0. 작성중(등록) 1.실행대기 2.수행중  3.실행오류  9.수행완료',
	`reqnum` FLOAT(10,3) UNSIGNED NOT NULL DEFAULT '0.000' COMMENT '(송신간격 or uri별건수)',
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
ENGINE=InnoDB
;

CREATE TABLE IF NOT EXISTS `texecjson` (
	`pkey` INT(11) NOT NULL COMMENT 'texecjob id',
	`jdata` LONGTEXT NULL DEFAULT NULL COLLATE 'utf8mb4_bin',
	PRIMARY KEY (`pkey`) USING BTREE
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
;
CREATE TABLE IF NOT EXISTS `texecing` (
	`pkey` INT(10) UNSIGNED NOT NULL COMMENT 'texecjob id',
	`tcnt` INT(10) UNSIGNED NULL DEFAULT '0' COMMENT '총건수',
	`ccnt` INT(10) UNSIGNED NULL DEFAULT '0' COMMENT '처리건수',
	`ecnt` INT(10) UNSIGNED NULL DEFAULT '0' COMMENT '오류건수',
	`qcnt` INT(10) UNSIGNED NULL DEFAULT '0',
	`pidv` INT(10) UNSIGNED NULL DEFAULT '0' COMMENT '작업pid',
	`elaps` DOUBLE(15,3) UNSIGNED NULL DEFAULT '0.000' COMMENT '경과시간(초)',
	`reqkill` CHAR(1) NULL DEFAULT '' COMMENT '"1".작업중지요청 ' COLLATE 'utf8_general_ci',
	PRIMARY KEY (`pkey`) USING HASH
	) ENGINE=MEMORY ;

CREATE TABLE IF NOT EXISTS `texecprog` (
	`pkey` INT(10) UNSIGNED NOT NULL COMMENT 'texecjob id',
	`progno` INT(10) UNSIGNED NOT NULL COMMENT '적용프로그램 id',
	`sn` INT(10) UNSIGNED NOT NULL DEFAULT '0',
	PRIMARY KEY (`pkey`, `progno`) USING BTREE
)
COMMENT='작업시 적용될 프로그램 정의'
COLLATE='utf8_general_ci'
ENGINE=InnoDB
;

CREATE TABLE IF NOT EXISTS `thostmap` (
	`tcode` VARCHAR(50) NOT NULL DEFAULT '' COLLATE 'utf8_general_ci',
	`appid` VARCHAR(50) NOT NULL DEFAULT '' COLLATE 'utf8_general_ci',
	`thost` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8_general_ci',
	`tport` INT(11) UNSIGNED NULL DEFAULT NULL,
	PRIMARY KEY (`tcode`, `appid`) USING BTREE
)
COMMENT='테스트 수행시 대상 host,port 를 정의'
COLLATE='utf8_general_ci'
ENGINE=InnoDB
;

CREATE TABLE IF NOT EXISTS `tmocksvr` (
	`pkey` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
	`svrnm` VARCHAR(50) NOT NULL COLLATE 'utf8_general_ci',
	`svrkind` TINYINT(1) UNSIGNED NOT NULL DEFAULT '0' COMMENT '0.tcp 1.http',
	`status` TINYINT(4) UNSIGNED NOT NULL DEFAULT '0' COMMENT '0.정지, 1.대기,2.실핼중 3.오류',
	`procid` INT(10) UNSIGNED NOT NULL DEFAULT '0' COMMENT '실행중 pid',
	`reqstop` TINYINT(3) UNSIGNED NOT NULL DEFAULT '0' COMMENT '1. 작업중지요청',
	`portno` SMALLINT(6) UNSIGNED NOT NULL DEFAULT '0' COMMENT '대기 port',
	`allowip` VARCHAR(20) NOT NULL DEFAULT '' COMMENT ',로 분리 지정(빈칸이면 모두허용)' COLLATE 'utf8_general_ci',
	`srcnm` VARCHAR(80) NOT NULL DEFAULT '' COMMENT '서버소스' COLLATE 'utf8_general_ci',
	PRIMARY KEY (`pkey`) USING BTREE
)
COMMENT='테스트를 위한 모의서버를 설정, 시작/종료 처리한다'
COLLATE='utf8_general_ci'
ENGINE=InnoDB
;

CREATE TABLE IF NOT EXISTS `tlevel` (
  `lvl` char(1) NOT NULL DEFAULT '0',
  `lvl_nm` varchar(50) NOT NULL DEFAULT '',
  `svc_cnt` int(10) unsigned NOT NULL DEFAULT 0,
  `data_cnt` int(10) unsigned NOT NULL DEFAULT 0 COMMENT '테스트수행건수',
  `scnt` int(10) unsigned NOT NULL DEFAULT 0 COMMENT '성공건수',
  PRIMARY KEY (`lvl`) USING BTREE
) ENGINE=InnoDB COMMENT='테스트 level 단위, 통합, 실시간 ';

INSERT INTO tlevel (lvl,lvl_nm, svc_cnt, data_cnt, scnt) values('1','단위',1,10,9),('2','통합',1,10,9),('3','정합성',0,0,0) ;

CREATE TABLE IF NOT EXISTS `tloaddata` (
	`pkey` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
	`tcode` VARCHAR(50) NOT NULL COLLATE 'utf8_general_ci',
	`o_stime` DATETIME(6) NOT NULL COMMENT 'org 송신시간',
	`stime` DATETIME(6) NOT NULL COMMENT '송신시간',
	`rtime` DATETIME(6) NOT NULL COMMENT '수신시간',
	`elapsed` DOUBLE(22,3) NOT NULL DEFAULT time_to_sec(timediff(`rtime`,`stime`)) COMMENT '소요시간',
	`svctime` DOUBLE(22,3) DEFAULT NULL AS (time_to_sec(timediff(`rtime`,`stime`))) virtual,
	`srcip` VARCHAR(30) NULL DEFAULT NULL COMMENT '소스ip' COLLATE 'utf8_general_ci',
	`srcport` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '소스port',
	`dstip` VARCHAR(30) NULL DEFAULT NULL COMMENT '목적지ip' COLLATE 'utf8_general_ci',
	`dstport` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '목적지port',
	`proto` CHAR(1) NULL DEFAULT '0' COMMENT '0.tcp 1.http 2.https' COLLATE 'utf8_general_ci',
	`method` VARCHAR(20) NULL DEFAULT NULL COMMENT 'method' COLLATE 'utf8_general_ci',
	`uri` VARCHAR(512) NULL DEFAULT NULL COLLATE 'utf8_general_ci',
	`seqno` INT(10) UNSIGNED NULL DEFAULT NULL,
	`ackno` INT(10) UNSIGNED NULL DEFAULT NULL,
	`rcode` INT(10) UNSIGNED NULL DEFAULT '0' COMMENT 'return code',
	`sflag` CHAR(1) DEFAULT NULL AS (if(`rcode` > 399,'2',if(`rcode` = 0,'0','1'))) virtual COLLATE 'utf8_general_ci',
	`rhead` VARCHAR(8192) NULL DEFAULT NULL COMMENT 'response header' COLLATE 'utf8_general_ci',
	`errinfo` VARCHAR(200) NULL DEFAULT NULL COLLATE 'utf8_general_ci',
	`slen` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '송신데이터길이',
	`rlen` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '수신데이터길이',
	`sdata` MEDIUMBLOB NULL DEFAULT NULL COMMENT '송신데이터',
	`rdata` MEDIUMBLOB NULL DEFAULT NULL COMMENT '수신데이터',
	`cdate` DATETIME(6) NULL DEFAULT current_timestamp(6) COMMENT '생성일시',
	PRIMARY KEY (`pkey`) USING BTREE,
	INDEX `tcode` (`tcode`, `o_stime`) USING BTREE,
	INDEX `uri` (`uri`, `o_stime`) USING BTREE
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
ROW_FORMAT=COMPRESSED;

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

CREATE TABLE `tsvcsum` (
	`tcode` VARCHAR(50) NOT NULL COLLATE 'utf8_general_ci',
	`svcid` VARCHAR(256) NOT NULL COLLATE 'utf8_general_ci',
	`appid` VARCHAR(50) NOT NULL COLLATE 'utf8_general_ci',
	`tcnt` INT(10) UNSIGNED NULL DEFAULT '0',
	`avgt` DOUBLE(22,3) NULL DEFAULT '0.000',
	`stdv` DOUBLE(22,3) NULL DEFAULT '0.000' COMMENT '표준편차',
	`scnt` INT(10) UNSIGNED NULL DEFAULT '0',
	`fcnt` INT(10) UNSIGNED NULL DEFAULT '0',
	`o_avgt` DOUBLE(22,3) UNSIGNED NULL DEFAULT '0.000',
	`o_stdv` DOUBLE(22,3) UNSIGNED NULL DEFAULT '0.000',
	`o_scnt` INT(10) UNSIGNED NULL DEFAULT '0',
	`o_fcnt` INT(10) UNSIGNED NULL DEFAULT '0',
	PRIMARY KEY (`tcode`, `svcid`, `appid`) USING BTREE
)
COMMENT='tid+서비스id+업무id 별 집계'
COLLATE='utf8_general_ci'
ENGINE=InnoDB;

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
	`pkey` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
	`cmpid` INT(10) UNSIGNED NOT NULL DEFAULT '0',
	`tcode` VARCHAR(50) NOT NULL COLLATE 'utf8_general_ci',
	`appid` VARCHAR(50) NOT NULL DEFAULT '' COLLATE 'utf8_general_ci',
	`o_stime` DATETIME(6) NOT NULL COMMENT 'org 송신시간',
	`stime` DATETIME(6) NOT NULL COMMENT '송신시간',
	`rtime` DATETIME(6) NOT NULL COMMENT '수신시간',
	`svctime` DOUBLE(22,3) DEFAULT NULL AS (time_to_sec(timediff(`rtime`,`stime`))) virtual,
	`elapsed` DOUBLE(22,3) NOT NULL DEFAULT time_to_sec(timediff(`rtime`,`stime`)) COMMENT '소요시간',
	`srcip` VARCHAR(30) NULL DEFAULT NULL COMMENT '소스ip' COLLATE 'utf8_general_ci',
	`srcport` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '소스port',
	`o_dstip` VARCHAR(30) NULL DEFAULT NULL COMMENT '목적지ip' COLLATE 'utf8_general_ci',
	`dstip` VARCHAR(30) NULL DEFAULT NULL COMMENT '목적지ip' COLLATE 'utf8_general_ci',
	`o_dstport` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '목적지port',
	`dstport` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '목적지port',
	`proto` CHAR(1) NULL DEFAULT '0' COMMENT '0.tcp 1.http 2.https' COLLATE 'utf8_general_ci',
	`method` VARCHAR(20) NULL DEFAULT NULL COMMENT 'method' COLLATE 'utf8_general_ci',
	`uri` VARCHAR(512) NULL DEFAULT NULL COLLATE 'utf8_general_ci',
	`seqno` INT(10) UNSIGNED NULL DEFAULT NULL,
	`ackno` INT(10) UNSIGNED NULL DEFAULT NULL,
	`rcode` INT(10) UNSIGNED NULL DEFAULT '0' COMMENT 'return code',
	`sflag` CHAR(1) DEFAULT NULL AS (if(`rcode` > 399,'2',if(`rcode` > 199,'1','0'))) virtual COLLATE 'utf8_general_ci',
	`rhead` VARCHAR(8192) NULL DEFAULT NULL COMMENT 'response header' COLLATE 'utf8_general_ci',
	`errinfo` VARCHAR(200) NULL DEFAULT NULL COLLATE 'utf8_general_ci',
	`slen` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '송신데이터길이',
	`rlen` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '수신데이터길이',
	`sdata` MEDIUMBLOB NULL DEFAULT NULL COMMENT '송신데이터',
	`rdata` MEDIUMBLOB NULL DEFAULT NULL COMMENT '수신데이터',
	`cdate` DATETIME(6) NULL DEFAULT current_timestamp(6) COMMENT '생성일시',
	`col1` VARCHAR(100) DEFAULT NULL AS (cast('yyy' as char(10) charset utf8mb4)) virtual COLLATE 'utf8_general_ci',
	`col2` VARCHAR(100) DEFAULT NULL AS (cast('ttt' as char(100) charset utf8mb4)) virtual COLLATE 'utf8_general_ci',
	PRIMARY KEY (`pkey`) USING BTREE,
	INDEX `cmpid` (`cmpid`) USING BTREE,
	INDEX `tcode` (`tcode`, `o_stime`) USING BTREE,
	INDEX `codesvc` (`tcode`, `uri`) USING BTREE
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
ROW_FORMAT=COMPRESSED;

CREATE TABLE IF NOT EXISTS `tinputdata` (
	`pkey` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
	`appid` VARCHAR(50) NOT NULL DEFAULT '' COLLATE 'utf8_general_ci',
	`sq` INT(10) UNSIGNED NOT NULL DEFAULT '0',
	`o_stime` DATETIME(6) NOT NULL COMMENT 'org 송신시간',
	`stime` DATETIME(6) NOT NULL COMMENT '송신시간',
	`rtime` DATETIME(6) NOT NULL COMMENT '수신시간',
	`svctime` DOUBLE(22,3) DEFAULT NULL AS (time_to_sec(timediff(`rtime`,`stime`))) virtual,
	`elapsed` DOUBLE(22,3) NOT NULL DEFAULT time_to_sec(timediff(`rtime`,`stime`)) COMMENT '소요시간',
	`srcip` VARCHAR(30) NULL DEFAULT NULL COMMENT '소스ip' COLLATE 'utf8_general_ci',
	`srcport` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '소스port',
	`o_dstip` VARCHAR(30) NULL DEFAULT NULL COMMENT '목적지ip' COLLATE 'utf8_general_ci',
	`dstip` VARCHAR(30) NULL DEFAULT NULL COMMENT '목적지ip' COLLATE 'utf8_general_ci',
	`o_dstport` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '목적지port',
	`dstport` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '목적지port',
	`proto` CHAR(1) NULL DEFAULT '0' COMMENT '0.tcp 1.http 2.https' COLLATE 'utf8_general_ci',
	`method` VARCHAR(20) NULL DEFAULT NULL COMMENT 'method' COLLATE 'utf8_general_ci',
	`uri` VARCHAR(512) NULL DEFAULT NULL COLLATE 'utf8_general_ci',
	`seqno` INT(10) UNSIGNED NULL DEFAULT NULL,
	`ackno` INT(10) UNSIGNED NULL DEFAULT NULL,
	`rcode` INT(10) UNSIGNED NULL DEFAULT '0' COMMENT 'return code',
	`sflag` CHAR(1) DEFAULT NULL AS (if(`rcode` > 399,'2',if(`rcode` > 199,'1','0'))) virtual COLLATE 'utf8_general_ci',
	`rhead` VARCHAR(8192) NULL DEFAULT NULL COMMENT 'response header' COLLATE 'utf8_general_ci',
	`errinfo` VARCHAR(200) NULL DEFAULT NULL COLLATE 'utf8_general_ci',
	`slen` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '송신데이터길이',
	`rlen` INT(10) UNSIGNED NULL DEFAULT NULL COMMENT '수신데이터길이',
	`sdata` MEDIUMBLOB NULL DEFAULT NULL COMMENT '송신데이터',
	`rdata` MEDIUMBLOB NULL DEFAULT NULL COMMENT '수신데이터',
	`cdate` DATETIME(6) NULL DEFAULT current_timestamp(6) COMMENT '생성일시',
	`col1` VARCHAR(100) DEFAULT NULL AS (cast('yyy' as char(10) charset utf8mb4)) virtual COLLATE 'utf8_general_ci',
	`col2` VARCHAR(100) DEFAULT NULL AS (cast('ttt' as char(100) charset utf8mb4)) virtual COLLATE 'utf8_general_ci',
	PRIMARY KEY (`pkey`) USING BTREE,
	INDEX `appid_sq` (`appid`, `sq`) USING BTREE,
	INDEX `appid_uri` (`appid`, `uri`) USING BTREE
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
ROW_FORMAT=COMPRESSED
;

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


-- 이벤트 ev_cnt_upd 구조 내보내기
DELIMITER //
CREATE or replace EVENT `ev_cnt_upd` ON SCHEDULE EVERY 1 DAY STARTS '2025-11-20 01:00:59' ON COMPLETION PRESERVE ENABLE COMMENT '서비스별 총누적건수 업데이트' DO BEGIN

	CALL sp_allsum();
END//
DELIMITER ;

-- 프로시저 sp_allsum 구조 내보내기
DELIMITER //
CREATE or REPLACE PROCEDURE `sp_allsum`()
BEGIN

	DECLARE done INT DEFAULT FALSE;
	DECLARE VCODE VARCHAR(50) ;
	DECLARE cur CURSOR FOR SELECT CODE tcode FROM tmaster WHERE lvl > '0'  ;
	
	DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  OPEN cur;

  read_loop: LOOP
    FETCH cur INTO VCODE;

    IF done THEN
      LEAVE read_loop;
    END IF;

	CALL sp_summary(vcode) ;
  END LOOP;

  CALL sp_insService() ;
  CLOSE cur;
END//
DELIMITER ;

-- 프로시저 aqtdb2.sp_copytestdata 구조 내보내기
DELIMITER //
CREATE or REPLACE PROCEDURE `sp_copytestdata`(
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
	
	INSERT INTO thostmap ( tcode, appid, thost, tport ) 
	SELECT @DST, appid, thost, tport FROM thostmap s
	WHERE tcode = @SRC 
	  AND NOT EXISTS (SELECT 1 FROM thostmap WHERE tcode = @DST AND appid = s.appid ) ;
	
	SELECT v_msg ;
	
	COMMIT;
END//
DELIMITER ;

-- 프로시저 aqtdb2.sp_insService 구조 내보내기
DELIMITER //
CREATE or REPLACE PROCEDURE `sp_insService`()
    COMMENT 'packet데이터로 부터 uri 가져옴'
BEGIN

INSERT INTO tservice (svcid, appid, svckor, svceng, svckind, task, manager, cumcnt )
SELECT c.* FROM 
( SELECT svcid, appid, regexp_replace(svcid,'.*/','') nn,regexp_replace(svcid,'.*/',''),
       '0', appid task ,'', COUNT(svcid) cumcnt
 FROM tsvcsum X
 GROUP BY svcid,  appid  ) c
 ON DUPLICATE KEY UPDATE cumcnt = c.cumcnt
;

END//
DELIMITER ;

-- 프로시저 aqtdb2.sp_loaddata 구조 내보내기
DELIMITER //
CREATE or REPLACE PROCEDURE `sp_loaddata`(
	IN `p_src` VARCHAR(50),
	IN `p_dst` VARCHAR(50),
	IN `p_cond` VARCHAR(500)
)
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

-- 프로시저 aqtdb2.sp_loaddata2 구조 내보내기
DELIMITER //
CREATE or REPLACE PROCEDURE `sp_loaddata2`(
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

-- 프로시저 aqtdb2.sp_summary 구조 내보내기
DELIMITER //
CREATE or REPLACE PROCEDURE `sp_summary`(
	IN `in_tcode` VARCHAR(50)
)
    COMMENT '데이터통계수집'
BEGIN
	UPDATE tsvcsum SET avgt=0,stdv=0,tcnt=0,scnt=0,fcnt=0
	 WHERE tcode = in_tcode ;
	
	INSERT  INTO  tsvcsum ( tcode, svcid, appid, tcnt, avgt, stdv, scnt, fcnt )
		SELECT * FROM 
		(select in_tcode, t.uri svcid, appid,  count(1) tcnt, IFNULL(round(avg(t.svctime),3),0) avgt,
		         IFNULL(round(stddev(t.svctime),3),0) stdv, sum(case when t.sflag = '1' then 1 else 0 end) scnt 
		        , sum(case when t.sflag = '2' then 1 else 0 end) fcnt 
		        from   Ttcppacket t   
		        WHERE tcode = in_tcode
		      GROUP BY  t.uri, t.appid
		      ) c
		 ON DUPLICATE KEY
		 UPDATE  tcnt = c.tcnt, avgt = c.avgt, stdv = c.stdv, scnt=c.scnt, fcnt=c.fcnt ;

	UPDATE tmaster T LEFT JOIN  (
		SELECT      tcode, sum(if(tcnt>0,1,0) ) svc_cnt
		, sum(if(fcnt>0,1,0)) fsvc_cnt
		, SUM(tcnt) data_cnt
		, sum(scnt) scnt
		, sum(fcnt) fcnt
		 from  tsvcsum 
		 WHERE TCODE = in_tcode 
		 GROUP BY TCODE
		) SUMM ON (t.code = summ.tcode)
	  SET T.svc_cnt = ifnull(summ.svc_cnt,0),
			T.fsvc_cnt = ifnull(summ.fsvc_cnt,0),
			T.data_cnt = ifnull(summ.data_cnt,0),
			T.scnt = ifnull(summ.scnt,0),
			T.fcnt = ifnull(summ.fcnt,0)
		WHERE t.code like in_tcode  ;
		
	UPDATE tlevel l, ( 
		SELECT lvl, COUNT(DISTINCT svcid ) svc_cnt, SUM(s.tcnt)  data_cnt, SUM(s.scnt) scnt
		 FROM  tsvcsum s join tmaster m ON (s.tcode = m.code)
		 WHERE lvl > '0' 
		 GROUP BY LVL  
	) s
	SET l.svc_cnt  = s.svc_cnt, l.data_cnt = s.data_cnt , l.scnt = s.scnt
	WHERE l.lvl = s.lvl ;
	
  
   COMMIT;
	
END//
DELIMITER ;

-- 프로시저 aqtdb2.sp_summtask 구조 내보내기
DELIMITER //
CREATE or REPLACE PROCEDURE `sp_summtask`(
	IN `in_task` VARCHAR(50)
)
BEGIN

	DELETE FROM ttasksum  WHERE NOT EXISTS 
	 ( SELECT 1 FROM vtcppacket a JOIN tservice b ON (a.uri = b.svcid AND b.appid = a.appid )  
	   WHERE ttasksum.task = b.task AND ttasksum.lvl = a.lvl) ;
	
	INSERT INTO ttasksum ( task, lvl, svc_cnt, fsvc_cnt, data_cnt, scnt, fcnt, udate )
	 SELECT APPID, lvl, svc_cnt, fsvc_cnt, data_cnt, scnt, fcnt , NOW() FROM 
	 ( 		SELECT      s.APPID, lvl, count(distinct if(s.tcnt>0,SVCID,NULL) ) svc_cnt
		, count(distinct case when s.fcnt>0 then SVCID end ) fsvc_cnt
		, SUM(s.tcnt) data_cnt
		, SUM(s.scnt) scnt
		, SUM(s.fcnt) fcnt
		 from  tsvcsum s JOIN tmaster m  ON (s.tcode = m.code)
		 WHERE s.APPID like in_task
		 GROUP BY s.APPID, lvl
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
