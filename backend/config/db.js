const mysql = require("mysql2");
const fs = require("fs");

const caPath = "/etc/secrets/ca.pem";

// Build connection options
const connectionOptions = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
};

// Only use SSL if a CA cert exists (e.g. Render deployment)
// For local/Docker development, skip SSL entirely
if (fs.existsSync(caPath)) {
  connectionOptions.ssl = { ca: fs.readFileSync(caPath) };
}

const connection = mysql.createPool(connectionOptions);

// You can still test connection by getting one connection
connection.getConnection((err, conn) => {
  if (err) {
    console.error("Database Connection Error:", err.message);
  } else {
    console.log("MySQL Connected via Pool");
    conn.release();
  }
});

module.exports = connection;