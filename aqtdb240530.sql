use aqtdb ;

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
