import fp from 'fastify-plugin';
import { MongoClient, Db } from 'mongodb';
import { FastifyInstance } from 'fastify';
import { config } from '../config/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    mongo: {
      db: Db;
      client: MongoClient;
    };
  }
}

async function mongoPlugin(fastify: FastifyInstance) {
  const client = new MongoClient(config.mongodb.uri, {
    maxPoolSize: 100,
    minPoolSize: 10,
    maxIdleTimeMS: 30000,
    waitQueueTimeoutMS: 10000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    tls: true,
    tlsCertificateKeyFile: config.mongodb.certPath,
  });

  try {
    await client.connect();
    fastify.log.info('MongoDB connected successfully');

    const db = client.db(config.mongodb.dbName);

    fastify.decorate('mongo', { db, client });

    fastify.addHook('onClose', async () => {
      await client.close();
      fastify.log.info('MongoDB connection closed');
    });
  } catch (error) {
    fastify.log.error('MongoDB connection failed:', error);
    throw error;
  }
}

export default fp(mongoPlugin, {
  name: 'mongodb',
});
