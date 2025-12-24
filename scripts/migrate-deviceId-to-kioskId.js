/**
 * MongoDB Migration Script: deviceId -> kioskId
 *
 * 이 스크립트는 모든 컬렉션에서 deviceId 필드를 kioskId로 변경합니다.
 * sales 컬렉션의 경우 device 객체를 kiosk로 변경합니다.
 *
 * 사용법:
 *   node scripts/migrate-deviceId-to-kioskId.js
 *
 * 환경변수:
 *   - MONGODB_URI: MongoDB 연결 문자열
 *   - MONGODB_DB_NAME: 데이터베이스 이름 (기본값: signature)
 *
 * 주의사항:
 *   - 마이그레이션 전 반드시 백업하세요
 *   - 인덱스는 별도로 재생성해야 합니다 (scripts/create-indexes.js)
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'signature';

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

// 마이그레이션 대상 컬렉션 (deviceId -> kioskId)
const COLLECTIONS_WITH_DEVICEID = [
  'sessions',
  'events',
  'performance',
  'errors',
  'dailySummary'
];

// 기존 인덱스 삭제 목록 (deviceId 기반)
const INDEXES_TO_DROP = {
  sessions: ['idx_sessions_deviceId_startedAt'],
  events: ['idx_events_deviceId_timestamp'],
  performance: ['idx_performance_deviceId_metricType_timestamp'],
  errors: ['idx_errors_deviceId_timestamp'],
  dailySummary: ['idx_dailySummary_date_deviceId_unique', 'idx_dailySummary_deviceId_date'],
  sales: ['idx_sales_timeDimension_hour_device']
};

async function migrateCollection(db, collectionName) {
  const collection = db.collection(collectionName);

  // deviceId가 있는 문서 카운트
  const count = await collection.countDocuments({ deviceId: { $exists: true } });

  if (count === 0) {
    console.log(`  ⏭️  ${collectionName}: deviceId 필드 없음, 건너뜀`);
    return 0;
  }

  console.log(`  🔄 ${collectionName}: ${count}개 문서 마이그레이션 중...`);

  // $rename 연산자로 필드명 변경
  const result = await collection.updateMany(
    { deviceId: { $exists: true } },
    { $rename: { deviceId: 'kioskId' } }
  );

  console.log(`  ✅ ${collectionName}: ${result.modifiedCount}개 문서 완료`);
  return result.modifiedCount;
}

async function migrateSalesCollection(db) {
  const collection = db.collection('sales');

  // device 객체가 있는 문서 카운트
  const count = await collection.countDocuments({ 'device.id': { $exists: true } });

  if (count === 0) {
    console.log('  ⏭️  sales: device 필드 없음, 건너뜀');
    return 0;
  }

  console.log(`  🔄 sales: ${count}개 문서 마이그레이션 중...`);

  // device 객체를 kiosk로 변경
  const result = await collection.updateMany(
    { 'device.id': { $exists: true } },
    { $rename: { device: 'kiosk' } }
  );

  console.log(`  ✅ sales: ${result.modifiedCount}개 문서 완료`);
  return result.modifiedCount;
}

async function dropOldIndexes(db) {
  console.log('\n🗑️  기존 deviceId 인덱스 삭제 중...');

  for (const [collectionName, indexNames] of Object.entries(INDEXES_TO_DROP)) {
    const collection = db.collection(collectionName);

    for (const indexName of indexNames) {
      try {
        await collection.dropIndex(indexName);
        console.log(`  ✅ ${collectionName}.${indexName} 삭제됨`);
      } catch (error) {
        if (error.codeName === 'IndexNotFound') {
          console.log(`  ⏭️  ${collectionName}.${indexName} 존재하지 않음, 건너뜀`);
        } else {
          console.error(`  ❌ ${collectionName}.${indexName} 삭제 실패:`, error.message);
        }
      }
    }
  }
}

async function verifyMigration(db) {
  console.log('\n🔍 마이그레이션 검증 중...');

  let hasOldFields = false;

  // deviceId 필드가 남아있는지 확인
  for (const collectionName of COLLECTIONS_WITH_DEVICEID) {
    const collection = db.collection(collectionName);
    const count = await collection.countDocuments({ deviceId: { $exists: true } });

    if (count > 0) {
      console.log(`  ❌ ${collectionName}: 아직 ${count}개 문서에 deviceId 필드 존재`);
      hasOldFields = true;
    } else {
      const kioskIdCount = await collection.countDocuments({ kioskId: { $exists: true } });
      console.log(`  ✅ ${collectionName}: kioskId 필드 ${kioskIdCount}개 확인됨`);
    }
  }

  // sales 컬렉션의 device 객체 확인
  const salesCollection = db.collection('sales');
  const deviceCount = await salesCollection.countDocuments({ 'device.id': { $exists: true } });

  if (deviceCount > 0) {
    console.log(`  ❌ sales: 아직 ${deviceCount}개 문서에 device 필드 존재`);
    hasOldFields = true;
  } else {
    const kioskCount = await salesCollection.countDocuments({ 'kiosk.id': { $exists: true } });
    console.log(`  ✅ sales: kiosk 필드 ${kioskCount}개 확인됨`);
  }

  return !hasOldFields;
}

async function migrate() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ MongoDB 연결 성공\n');

    const db = client.db(DB_NAME);

    // 1. deviceId -> kioskId 마이그레이션
    console.log('📦 deviceId → kioskId 필드 마이그레이션...');

    let totalMigrated = 0;

    for (const collectionName of COLLECTIONS_WITH_DEVICEID) {
      const migrated = await migrateCollection(db, collectionName);
      totalMigrated += migrated;
    }

    // 2. sales 컬렉션의 device -> kiosk 마이그레이션
    console.log('\n📦 sales.device → sales.kiosk 필드 마이그레이션...');
    const salesMigrated = await migrateSalesCollection(db);
    totalMigrated += salesMigrated;

    // 3. 기존 인덱스 삭제
    await dropOldIndexes(db);

    // 4. 마이그레이션 검증
    const isSuccess = await verifyMigration(db);

    console.log('\n' + '='.repeat(50));
    if (isSuccess) {
      console.log('✅ 마이그레이션 완료!');
      console.log(`   총 ${totalMigrated}개 문서가 마이그레이션되었습니다.`);
      console.log('\n⚠️  다음 단계:');
      console.log('   1. 새 인덱스 생성: node scripts/create-indexes.js');
      console.log('   2. 애플리케이션 재배포');
    } else {
      console.log('❌ 마이그레이션 일부 실패. 위 로그를 확인하세요.');
      process.exit(1);
    }

  } catch (error) {
    console.error('마이그레이션 중 오류 발생:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nMongoDB 연결 종료');
  }
}

// 롤백 함수 (필요시 사용)
async function rollback() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ MongoDB 연결 성공\n');
    console.log('⚠️  롤백 모드: kioskId → deviceId\n');

    const db = client.db(DB_NAME);

    // kioskId -> deviceId 롤백
    for (const collectionName of COLLECTIONS_WITH_DEVICEID) {
      const collection = db.collection(collectionName);
      const result = await collection.updateMany(
        { kioskId: { $exists: true } },
        { $rename: { kioskId: 'deviceId' } }
      );
      console.log(`  ${collectionName}: ${result.modifiedCount}개 문서 롤백`);
    }

    // sales 컬렉션 롤백
    const salesCollection = db.collection('sales');
    const salesResult = await salesCollection.updateMany(
      { 'kiosk.id': { $exists: true } },
      { $rename: { kiosk: 'device' } }
    );
    console.log(`  sales: ${salesResult.modifiedCount}개 문서 롤백`);

    console.log('\n✅ 롤백 완료');

  } catch (error) {
    console.error('롤백 중 오류 발생:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// 명령행 인자 확인
const args = process.argv.slice(2);

if (args.includes('--rollback')) {
  console.log('🔙 롤백 모드로 실행합니다...\n');
  rollback();
} else {
  console.log('🚀 deviceId → kioskId 마이그레이션을 시작합니다...\n');
  migrate();
}
