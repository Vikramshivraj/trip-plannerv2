const mysql = require("mysql2");
const fs = require("fs");

const sslConfig = {};
const caPath = "/etc/secrets/ca.pem";

// If deployed on Render, use their secret file path. 
// Otherwise, allow connection locally without strict CA verification.
if (fs.existsSync(caPath)) {
  sslConfig.ca = fs.readFileSync(caPath);
} else {
  sslConfig.rejectUnauthorized = false;
}

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: sslConfig,
});

connection.connect((err) => {
  if (err) {
    console.log("Database Error", err);
  } else {
    console.log("MySQL Connected");
  }
});

module.exports = connection;