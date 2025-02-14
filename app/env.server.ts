import * as dotenv from 'dotenv';

dotenv.config();

export const ENV = {
  DATABASE_URL: process.env.TURSO_DATABASE_URL!,
  DATABASE_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN!,
  SOCKET_SERVER_URL: process.env.SOCKET_SERVER_URL,
} as const; 