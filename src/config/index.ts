import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env') });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function resolveCertPath(certPath: string): string {
  // 절대 경로면 그대로 사용 (Cloud Run Secret Manager 마운트 경로)
  if (certPath.startsWith('/')) {
    return certPath;
  }
  // 상대 경로면 프로젝트 루트 기준으로 resolve
  return resolve(__dirname, '../..', certPath);
}

export const config = {
  mongodb: {
    uri: requireEnv('MONGODB_URI'),
    certPath: resolveCertPath(requireEnv('MONGODB_CERT_PATH')),
    dbName: requireEnv('MONGODB_DB_NAME'),
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  },
} as const;

export type Config = typeof config;
