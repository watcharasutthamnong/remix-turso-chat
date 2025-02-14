import { initDB } from './db.server';

console.log('init.server.ts');

if (process.env.NODE_ENV !== 'production') {
  initDB().catch(console.error);
}