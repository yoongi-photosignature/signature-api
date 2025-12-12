import { buildApp } from './app.js';
import { config } from './config/index.js';

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: config.server.port, host: '0.0.0.0' });
    console.log(`
╔════════════════════════════════════════════════╗
║       PhotoSignature API Server                ║
╠════════════════════════════════════════════════╣
║  Port: ${String(config.server.port).padEnd(39)}║
║  Environment: ${config.server.nodeEnv.padEnd(32)}║
║  Database: ${config.mongodb.dbName.padEnd(35)}║
╚════════════════════════════════════════════════╝
    `);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
