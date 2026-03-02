import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Build config so password is always a string (pg/SCRAM requires it)
function getDbConfig() {
  const connectionString = process.env.DATABASE_URL;
  let config;

  if (connectionString && connectionString.trim()) {
    try {
      // Parse postgresql://user:password@host:port/dbname so password is always a string
      const url = new URL(connectionString.trim().replace(/^postgresql:\/\//i, 'http://'));
      config = {
        host: url.hostname || 'localhost',
        port: url.port ? parseInt(url.port, 10) : 5432,
        database: (url.pathname || '/').slice(1).replace(/^\/+/, '') || 'travel_agency',
        user: url.username ? decodeURIComponent(url.username) : 'postgres',
        password: url.password ? decodeURIComponent(url.password) : '',
      };
    } catch (_) {
      // Fall back to explicit vars so password is never undefined
      config = null;
    }
  }
  if (!config) {
    config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'travel_agency',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD != null ? String(process.env.DB_PASSWORD) : '',
    };
  }

  // pg/SCRAM requires password to be a string; never pass undefined
  config.password = config.password != null ? String(config.password) : '';
  return config;
}

const pool = new Pool(getDbConfig());

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

export default pool;
