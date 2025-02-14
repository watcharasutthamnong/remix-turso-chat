import { createClient } from '@libsql/client';
import { ENV } from './env.server';

const db = createClient({
  url: ENV.DATABASE_URL,
  authToken: ENV.DATABASE_AUTH_TOKEN,
});

// Initialize database
export async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      username TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      username TEXT NOT NULL,
      FOREIGN KEY(message_id) REFERENCES messages(id)
    )
  `);
}

export { db };