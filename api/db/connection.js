const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

const dbConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  port: 3306,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  // Supprimez acquireTimeout et reconnect (non supportés par mysql2)
};

console.log('🔗 Connexion à la base de données avec les paramètres suivants:', process.env.DB_HOST, process.env.DB_PORT, process.env.DB_PORT, process.env.DB_NAME );

const pool = mysql.createPool(dbConfig);

// Test de connexion
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL connectée');
    connection.release();
  } catch (error) {
    console.error('❌ Erreur MySQL:', error.message);
  }
}

testConnection();

module.exports = pool;
