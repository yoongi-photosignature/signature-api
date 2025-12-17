import Fastify, { FastifyInstance } from 'fastify';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    mongo: {
      db: Db;
      client: MongoClient;
    };
  }
}

export interface TestContext {
  app: FastifyInstance;
  db: Db;
  mongoServer: MongoMemoryServer;
}

async function testMongoPlugin(fastify: FastifyInstance, options: { uri: string; database: string }) {
  const client = new MongoClient(options.uri);

  try {
    await client.connect();
    const db = client.db(options.database);
    fastify.decorate('mongo', { db, client });

    fastify.addHook('onClose', async () => {
      await client.close();
    });
  } catch (error) {
    fastify.log.error(error, 'MongoDB connection failed');
    throw error;
  }
}

const mongoPlugin = fp(testMongoPlugin, { name: 'mongodb' });

export async function createTestApp(): Promise<TestContext> {
  // MongoDB Memory Server 시작
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // MongoDB 클라이언트 직접 생성
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db('test-db');

  // Fastify 앱 생성
  const app = Fastify({
    logger: false, // 테스트 시 로그 비활성화
  });

  // MongoDB 데코레이터 추가
  app.decorate('mongo', { db, client });

  return {
    app,
    db,
    mongoServer,
  };
}

export async function closeTestApp(context: TestContext): Promise<void> {
  await context.app.close();
  await context.mongoServer.stop();
}
