module.exports = {
  user: process.env.ORA_USER || 'orausr',
  password: process.env.ORA_PASS || 'Dawinit1!',
  connectString: process.env.ORA_CONNECTSTRING ?? "111.111.111.111:1521/orcl",
  externalAuth: false
};
