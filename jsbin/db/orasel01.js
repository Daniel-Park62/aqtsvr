'use strict';

const oracledb = require('oracledb');
const oraConfig = require('./oraconfig.js');

exports.getTaskid = async function (imgid) {

  let conn;
  let rst ;
  try {

    conn = await oracledb.getConnection(oraConfig);
    const result = await conn.execute(
      `SELECT taskid  FROM bpmtbl where imgid = :id`,
      [imgid],
      {
        maxRows: 1
      });
    rst = result.rows[0].taskid ;
    console.log("Query rows:", result.rows);
  } catch (err) {
    console.error(err);
    rst = null ;
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch (err) {
        console.error(err);
      }
    }
    return(rst) ;
  }
}
