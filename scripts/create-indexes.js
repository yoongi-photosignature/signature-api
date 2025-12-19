/**
 * MongoDB 인덱스 생성 스크립트
 *
 * 사용법: node scripts/create-indexes.js
 *
 * 환경변수:
 * - MONGODB_URI: MongoDB 연결 문자열
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

async function createIndexes() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('MongoDB 연결 성공');

    const db = client.db(DB_NAME);

    // ============================================================
    // sessions 컬렉션 인덱스
    // ============================================================
    console.log('\n📦 sessions 컬렉션 인덱스 생성...');
    const sessions = db.collection('sessions');

    // 기본키 (unique)
    await sessions.createIndex(
      { sessionId: 1 },
      { unique: true, name: 'idx_sessions_sessionId_unique' }
    );
    console.log('  ✅ sessionId (unique)');

    // 디바이스별 세션 조회 (최신순)
    await sessions.createIndex(
      { deviceId: 1, startedAt: -1 },
      { name: 'idx_sessions_deviceId_startedAt' }
    );
    console.log('  ✅ deviceId + startedAt');

    // 그룹별 세션 조회 (최신순)
    await sessions.createIndex(
      { groupId: 1, startedAt: -1 },
      { name: 'idx_sessions_groupId_startedAt' }
    );
    console.log('  ✅ groupId + startedAt');

    // 매장별 세션 조회 (최신순)
    await sessions.createIndex(
      { storeId: 1, startedAt: -1 },
      { name: 'idx_sessions_storeId_startedAt' }
    );
    console.log('  ✅ storeId + startedAt');

    // 상태 + 시간 복합 인덱스
    await sessions.createIndex(
      { startedAt: -1, status: 1 },
      { name: 'idx_sessions_startedAt_status' }
    );
    console.log('  ✅ startedAt + status');

    // 이탈 분석용 인덱스 (sparse)
    await sessions.createIndex(
      { status: 1, 'funnel.exitStage': 1 },
      { name: 'idx_sessions_status_exitStage', sparse: true }
    );
    console.log('  ✅ status + funnel.exitStage (sparse)');

    // 국가별 분석
    await sessions.createIndex(
      { countryCode: 1, startedAt: -1 },
      { name: 'idx_sessions_countryCode_startedAt' }
    );
    console.log('  ✅ countryCode + startedAt');

    // TTL 인덱스 (1년 후 자동 삭제)
    await sessions.createIndex(
      { createdAt: 1 },
      {
        name: 'idx_sessions_ttl_1year',
        expireAfterSeconds: 31536000  // 365일
      }
    );
    console.log('  ✅ TTL 인덱스 (1년)');

    // ============================================================
    // sales 컬렉션 신규 인덱스
    // ============================================================
    console.log('\n📦 sales 컬렉션 신규 인덱스 생성...');
    const sales = db.collection('sales');

    // sessionId 인덱스 (세션-매출 연결)
    await sales.createIndex(
      { sessionId: 1 },
      { name: 'idx_sales_sessionId', sparse: true }
    );
    console.log('  ✅ sessionId (sparse)');

    // 정산 상태 인덱스
    await sales.createIndex(
      { 'settlement.status': 1, 'settlement.scheduledDate': 1 },
      { name: 'idx_sales_settlement', sparse: true }
    );
    console.log('  ✅ settlement.status + scheduledDate (sparse)');

    // 시간 차원 인덱스 (연/월별 집계)
    await sales.createIndex(
      { 'timeDimension.year': 1, 'timeDimension.month': 1, 'store.id': 1 },
      { name: 'idx_sales_timeDimension_store' }
    );
    console.log('  ✅ timeDimension.year/month + store.id');

    // 시간 차원 인덱스 (주간 집계)
    await sales.createIndex(
      { 'timeDimension.year': 1, 'timeDimension.week': 1 },
      { name: 'idx_sales_timeDimension_week' }
    );
    console.log('  ✅ timeDimension.year + week');

    // 시간대별 분석
    await sales.createIndex(
      { 'timeDimension.hour': 1, 'device.id': 1 },
      { name: 'idx_sales_timeDimension_hour_device' }
    );
    console.log('  ✅ timeDimension.hour + device.id');

    // ============================================================
    // events 컬렉션 인덱스 (Time-Series)
    // ============================================================
    console.log('\n📦 events 컬렉션 인덱스 생성...');
    const events = db.collection('events');

    // 세션별 이벤트 조회
    await events.createIndex(
      { sessionId: 1, sequenceNo: 1 },
      { unique: true, name: 'idx_events_sessionId_sequenceNo_unique' }
    );
    console.log('  ✅ sessionId + sequenceNo (unique)');

    // 디바이스별 이벤트 조회
    await events.createIndex(
      { deviceId: 1, timestamp: -1 },
      { name: 'idx_events_deviceId_timestamp' }
    );
    console.log('  ✅ deviceId + timestamp');

    // 이벤트 타입별 조회
    await events.createIndex(
      { eventType: 1, timestamp: -1 },
      { name: 'idx_events_eventType_timestamp' }
    );
    console.log('  ✅ eventType + timestamp');

    // ============================================================
    // performance 컬렉션 인덱스 (Time-Series)
    // ============================================================
    console.log('\n📦 performance 컬렉션 인덱스 생성...');
    const performance = db.collection('performance');

    // 디바이스 + 메트릭 타입 + 시간
    await performance.createIndex(
      { deviceId: 1, metricType: 1, timestamp: -1 },
      { name: 'idx_performance_deviceId_metricType_timestamp' }
    );
    console.log('  ✅ deviceId + metricType + timestamp');

    // 세션별 성능 조회
    await performance.createIndex(
      { sessionId: 1, metricType: 1 },
      { name: 'idx_performance_sessionId_metricType', sparse: true }
    );
    console.log('  ✅ sessionId + metricType (sparse)');

    // 성공 여부별 분석
    await performance.createIndex(
      { success: 1, metricType: 1, timestamp: -1 },
      { name: 'idx_performance_success_metricType_timestamp' }
    );
    console.log('  ✅ success + metricType + timestamp');

    // ============================================================
    // errors 컬렉션 인덱스
    // ============================================================
    console.log('\n📦 errors 컬렉션 인덱스 생성...');
    const errors = db.collection('errors');

    // 디바이스별 에러 조회
    await errors.createIndex(
      { deviceId: 1, timestamp: -1 },
      { name: 'idx_errors_deviceId_timestamp' }
    );
    console.log('  ✅ deviceId + timestamp');

    // 심각도별 조회
    await errors.createIndex(
      { severity: 1, timestamp: -1 },
      { name: 'idx_errors_severity_timestamp' }
    );
    console.log('  ✅ severity + timestamp');

    // 카테고리별 조회
    await errors.createIndex(
      { category: 1, timestamp: -1 },
      { name: 'idx_errors_category_timestamp' }
    );
    console.log('  ✅ category + timestamp');

    // 해결 상태별 조회
    await errors.createIndex(
      { resolved: 1, severity: 1, timestamp: -1 },
      { name: 'idx_errors_resolved_severity_timestamp' }
    );
    console.log('  ✅ resolved + severity + timestamp');

    // 세션별 에러 조회
    await errors.createIndex(
      { sessionId: 1 },
      { name: 'idx_errors_sessionId', sparse: true }
    );
    console.log('  ✅ sessionId (sparse)');

    // ============================================================
    // dailySummary 컬렉션 인덱스
    // ============================================================
    console.log('\n📦 dailySummary 컬렉션 인덱스 생성...');
    const dailySummary = db.collection('dailySummary');

    // 기본키 (unique)
    await dailySummary.createIndex(
      { date: 1, deviceId: 1 },
      { unique: true, name: 'idx_dailySummary_date_deviceId_unique' }
    );
    console.log('  ✅ date + deviceId (unique)');

    // 매장별 요약 조회
    await dailySummary.createIndex(
      { storeId: 1, date: -1 },
      { name: 'idx_dailySummary_storeId_date' }
    );
    console.log('  ✅ storeId + date');

    // 그룹별 요약 조회
    await dailySummary.createIndex(
      { groupId: 1, date: -1 },
      { name: 'idx_dailySummary_groupId_date' }
    );
    console.log('  ✅ groupId + date');

    // 디바이스별 요약 조회
    await dailySummary.createIndex(
      { deviceId: 1, date: -1 },
      { name: 'idx_dailySummary_deviceId_date' }
    );
    console.log('  ✅ deviceId + date');

    // 국가별 요약 조회
    await dailySummary.createIndex(
      { countryCode: 1, date: -1 },
      { name: 'idx_dailySummary_countryCode_date' }
    );
    console.log('  ✅ countryCode + date');

    // ============================================================
    // 인덱스 확인
    // ============================================================
    console.log('\n📋 생성된 인덱스 확인...');

    const sessionsIndexes = await sessions.indexes();
    console.log('\nsessions 컬렉션 인덱스:');
    sessionsIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    const salesIndexes = await sales.indexes();
    console.log('\nsales 컬렉션 인덱스:');
    salesIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    const eventsIndexes = await events.indexes();
    console.log('\nevents 컬렉션 인덱스:');
    eventsIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    const performanceIndexes = await performance.indexes();
    console.log('\nperformance 컬렉션 인덱스:');
    performanceIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    const errorsIndexes = await errors.indexes();
    console.log('\nerrors 컬렉션 인덱스:');
    errorsIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    const dailySummaryIndexes = await dailySummary.indexes();
    console.log('\ndailySummary 컬렉션 인덱스:');
    dailySummaryIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    console.log('\n✅ 모든 인덱스 생성 완료!');

  } catch (error) {
    console.error('인덱스 생성 중 오류 발생:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\nMongoDB 연결 종료');
  }
}

createIndexes();
