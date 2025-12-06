const mysql = require('mysql2');
const pool = mysql.createPool({
  host: 'localhost',
  user: 'DB_USER_NAME',
  password: 'YOUR_DB_PASSWORD',
  database: 'YOUR_DB_NAME'
});
module.exports = pool.promise();
