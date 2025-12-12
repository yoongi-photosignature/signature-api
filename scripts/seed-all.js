/**
 * PhotoSignature MongoDB Seed Script (All Collections)
 *
 * sales 데이터와 일치하는 stores, devices, popups, exchangeRates 데이터 생성
 */

import { MongoClient, Decimal128 } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'photosignature';
const CERT_PATH = process.env.MONGODB_CERT_PATH;

// ============================================================
// stores 더미 데이터 (sales와 일치)
// ============================================================
const dummyStores = [
  {
    _id: 'STORE_001',
    name: '강남점',
    group: { id: 'GROUP_GANGNAM', name: '강남지점', grade: 'HIGH' },
    country: { code: 'KOR', name: 'Korea', currency: 'KRW' },
    owner: { phone: '010-1234-5678' },
    settlement: { serverFeeRate: 0.07, vatEnabled: true },
    devices: ['KIOSK_001', 'KIOSK_002'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  },
  {
    _id: 'STORE_002',
    name: '홍대점',
    group: { id: 'GROUP_HONGDAE', name: '홍대지점', grade: 'MID' },
    country: { code: 'KOR', name: 'Korea', currency: 'KRW' },
    owner: { phone: '010-2345-6789' },
    settlement: { serverFeeRate: 0.07, vatEnabled: true },
    devices: ['KIOSK_003'],
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date()
  },
  {
    _id: 'STORE_003',
    name: '도쿄 시부야점',
    group: { id: 'GROUP_TOKYO', name: '도쿄지점', grade: 'HIGH' },
    country: { code: 'JPN', name: 'Japan', currency: 'JPY' },
    owner: { phone: '+81-90-1234-5678' },
    settlement: { serverFeeRate: 0.04, vatEnabled: false },
    devices: ['KIOSK_004'],
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date()
  },
  {
    _id: 'STORE_004',
    name: '호치민점',
    group: { id: 'GROUP_VIETNAM', name: '베트남지점', grade: 'MID' },
    country: { code: 'VNM', name: 'Vietnam', currency: 'VND' },
    owner: { phone: '+84-90-123-4567' },
    settlement: { serverFeeRate: 0.04, vatEnabled: false },
    devices: ['KIOSK_005'],
    createdAt: new Date('2024-04-01'),
    updatedAt: new Date()
  },
  {
    _id: 'STORE_005',
    name: 'LA점',
    group: { id: 'GROUP_USA', name: '미국지점', grade: 'HIGH' },
    country: { code: 'USA', name: 'USA', currency: 'USD' },
    owner: { phone: '+1-310-123-4567' },
    settlement: { serverFeeRate: 0.04, vatEnabled: false },
    devices: ['KIOSK_006'],
    createdAt: new Date('2024-05-01'),
    updatedAt: new Date()
  },
  {
    _id: 'STORE_006',
    name: '부산 서면점',
    group: { id: 'GROUP_BUSAN', name: '부산지점', grade: 'MID' },
    country: { code: 'KOR', name: 'Korea', currency: 'KRW' },
    owner: { phone: '010-3456-7890' },
    settlement: { serverFeeRate: 0.07, vatEnabled: true },
    devices: ['KIOSK_007'],
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date()
  },
  {
    _id: 'STORE_007',
    name: '대구점',
    group: { id: 'GROUP_DAEGU', name: '대구지점', grade: 'LOW' },
    country: { code: 'KOR', name: 'Korea', currency: 'KRW' },
    owner: { phone: '010-4567-8901' },
    settlement: { serverFeeRate: 0.07, vatEnabled: true },
    devices: ['KIOSK_008'],
    createdAt: new Date('2024-07-01'),
    updatedAt: new Date()
  },
  {
    _id: 'STORE_008',
    name: '오사카점',
    group: { id: 'GROUP_OSAKA', name: '오사카지점', grade: 'MID' },
    country: { code: 'JPN', name: 'Japan', currency: 'JPY' },
    owner: { phone: '+81-90-8765-4321' },
    settlement: { serverFeeRate: 0.04, vatEnabled: false },
    devices: ['KIOSK_009'],
    createdAt: new Date('2024-08-01'),
    updatedAt: new Date()
  },
  {
    _id: 'STORE_009',
    name: '제주점',
    group: { id: 'GROUP_JEJU', name: '제주지점', grade: 'LOW' },
    country: { code: 'KOR', name: 'Korea', currency: 'KRW' },
    owner: { phone: '010-5678-9012' },
    settlement: { serverFeeRate: 0.07, vatEnabled: true },
    devices: ['KIOSK_010'],
    createdAt: new Date('2024-09-01'),
    updatedAt: new Date()
  }
];

// ============================================================
// devices 더미 데이터 (stores와 일치)
// ============================================================
const dummyDevices = [
  {
    _id: 'KIOSK_001',
    name: 'Gangnam_Unit1',
    hddSerial: 'HDD_GN_001',
    store: { id: 'STORE_001', name: '강남점' },
    country: { code: 'KOR', name: 'Korea', currency: 'KRW' },
    programType: 'SIGNATURE',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  },
  {
    _id: 'KIOSK_002',
    name: 'Gangnam_Unit2',
    hddSerial: 'HDD_GN_002',
    store: { id: 'STORE_001', name: '강남점' },
    country: { code: 'KOR', name: 'Korea', currency: 'KRW' },
    programType: 'SIGNATURE',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date()
  },
  {
    _id: 'KIOSK_003',
    name: 'Hongdae_Unit1',
    hddSerial: 'HDD_HD_001',
    store: { id: 'STORE_002', name: '홍대점' },
    country: { code: 'KOR', name: 'Korea', currency: 'KRW' },
    programType: 'SIGNATURE',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date()
  },
  {
    _id: 'KIOSK_004',
    name: 'Tokyo_Unit1',
    hddSerial: 'HDD_TK_001',
    store: { id: 'STORE_003', name: '도쿄 시부야점' },
    country: { code: 'JPN', name: 'Japan', currency: 'JPY' },
    programType: 'SIGNATURE',
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date()
  },
  {
    _id: 'KIOSK_005',
    name: 'HCM_Unit1',
    hddSerial: 'HDD_HCM_001',
    store: { id: 'STORE_004', name: '호치민점' },
    country: { code: 'VNM', name: 'Vietnam', currency: 'VND' },
    programType: 'SIGNATURE',
    createdAt: new Date('2024-04-01'),
    updatedAt: new Date()
  },
  {
    _id: 'KIOSK_006',
    name: 'LA_Unit1',
    hddSerial: 'HDD_LA_001',
    store: { id: 'STORE_005', name: 'LA점' },
    country: { code: 'USA', name: 'USA', currency: 'USD' },
    programType: 'SIGNATURE',
    createdAt: new Date('2024-05-01'),
    updatedAt: new Date()
  },
  {
    _id: 'KIOSK_007',
    name: 'Busan_Unit1',
    hddSerial: 'HDD_BS_001',
    store: { id: 'STORE_006', name: '부산 서면점' },
    country: { code: 'KOR', name: 'Korea', currency: 'KRW' },
    programType: 'SIGNATURE',
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date()
  },
  {
    _id: 'KIOSK_008',
    name: 'Daegu_Unit1',
    hddSerial: 'HDD_DG_001',
    store: { id: 'STORE_007', name: '대구점' },
    country: { code: 'KOR', name: 'Korea', currency: 'KRW' },
    programType: 'SIGNATURE',
    createdAt: new Date('2024-07-01'),
    updatedAt: new Date()
  },
  {
    _id: 'KIOSK_009',
    name: 'Osaka_Unit1',
    hddSerial: 'HDD_OS_001',
    store: { id: 'STORE_008', name: '오사카점' },
    country: { code: 'JPN', name: 'Japan', currency: 'JPY' },
    programType: 'SIGNATURE',
    createdAt: new Date('2024-08-01'),
    updatedAt: new Date()
  },
  {
    _id: 'KIOSK_010',
    name: 'Jeju_Unit1',
    hddSerial: 'HDD_JJ_001',
    store: { id: 'STORE_009', name: '제주점' },
    country: { code: 'KOR', name: 'Korea', currency: 'KRW' },
    programType: 'SIGNATURE',
    createdAt: new Date('2024-09-01'),
    updatedAt: new Date()
  }
];

// ============================================================
// popups 더미 데이터 (sales와 일치)
// ============================================================
const dummyPopups = [
  {
    _id: 'POPUP_SANRIO_2025',
    name: 'Sanrio Characters 2025',
    character: { id: 'KUROMI', name: 'Kuromi', code: 'SANRIO_KUROMI' },
    status: 'ACTIVE',
    period: { start: new Date('2025-01-01'), end: new Date('2025-06-30') },
    endedAt: null,
    countries: ['ALL'],
    revenueConfig: { storeRate: 0.25, corpRate: 0.55, licenseRate: 0.20 },
    discountConfig: { type: 'ROULETTE', rouletteRates: [0, 0.1, 0.2, 0.3], maxDiscount: Decimal128.fromString('2000') },
    pricing: {
      currency: 'KRW',
      '3CUT': { price: Decimal128.fromString('4000'), printCount: 1 },
      '4CUT': { price: Decimal128.fromString('5000'), printCount: 2 },
      '6CUT': { price: Decimal128.fromString('6000'), printCount: 2 }
    },
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date()
  },
  {
    _id: 'POPUP_KAKAO_2025',
    name: 'Kakao Friends 2025',
    character: { id: 'RYAN', name: 'Ryan', code: 'KAKAO_RYAN' },
    status: 'ACTIVE',
    period: { start: new Date('2025-01-01'), end: new Date('2025-03-31') },
    endedAt: null,
    countries: ['KOR'],
    revenueConfig: { storeRate: 0.30, corpRate: 0.50, licenseRate: 0.20 },
    discountConfig: { type: 'COUPON', rouletteRates: null, maxDiscount: Decimal128.fromString('1000') },
    pricing: {
      currency: 'KRW',
      '3CUT': { price: Decimal128.fromString('4500'), printCount: 1 },
      '4CUT': { price: Decimal128.fromString('5500'), printCount: 2 },
      '6CUT': { price: Decimal128.fromString('6500'), printCount: 2 }
    },
    createdAt: new Date('2024-12-15'),
    updatedAt: new Date()
  },
  {
    _id: 'POPUP_DISNEY_2025',
    name: 'Disney 100th Anniversary',
    character: { id: 'MICKEY', name: 'Mickey Mouse', code: 'DISNEY_MICKEY' },
    status: 'ACTIVE',
    period: { start: new Date('2025-01-01'), end: new Date('2025-12-31') },
    endedAt: null,
    countries: ['ALL'],
    revenueConfig: { storeRate: 0.20, corpRate: 0.50, licenseRate: 0.30 },
    discountConfig: { type: 'FIXED', rouletteRates: null, maxDiscount: Decimal128.fromString('1500') },
    pricing: {
      currency: 'KRW',
      '3CUT': { price: Decimal128.fromString('5000'), printCount: 1 },
      '4CUT': { price: Decimal128.fromString('6000'), printCount: 2 },
      '6CUT': { price: Decimal128.fromString('7000'), printCount: 2 },
      '8CUT': { price: Decimal128.fromString('10000'), printCount: 4 }
    },
    createdAt: new Date('2024-11-01'),
    updatedAt: new Date()
  }
];

// ============================================================
// exchangeRates 더미 데이터 (sales 날짜와 일치)
// ============================================================
const dummyExchangeRates = [
  {
    _id: '2025-01-15',
    baseCurrency: 'KRW',
    rates: { KRW: 1, JPY: 9.12, USD: 1450.5, VND: 0.054 },
    source: 'exchangerate-api',
    apiEndpoint: 'https://api.exchangerate-api.com/v4/latest/KRW',
    fetchedAt: new Date('2025-01-15T00:00:00Z')
  },
  {
    _id: '2025-01-16',
    baseCurrency: 'KRW',
    rates: { KRW: 1, JPY: 9.15, USD: 1452.3, VND: 0.055 },
    source: 'exchangerate-api',
    apiEndpoint: 'https://api.exchangerate-api.com/v4/latest/KRW',
    fetchedAt: new Date('2025-01-16T00:00:00Z')
  },
  {
    _id: '2025-01-17',
    baseCurrency: 'KRW',
    rates: { KRW: 1, JPY: 9.20, USD: 1455.0, VND: 0.054 },
    source: 'exchangerate-api',
    apiEndpoint: 'https://api.exchangerate-api.com/v4/latest/KRW',
    fetchedAt: new Date('2025-01-17T00:00:00Z')
  },
  {
    _id: '2025-01-18',
    baseCurrency: 'KRW',
    rates: { KRW: 1, JPY: 9.18, USD: 1458.0, VND: 0.054 },
    source: 'exchangerate-api',
    apiEndpoint: 'https://api.exchangerate-api.com/v4/latest/KRW',
    fetchedAt: new Date('2025-01-18T00:00:00Z')
  },
  {
    _id: '2025-01-19',
    baseCurrency: 'KRW',
    rates: { KRW: 1, JPY: 9.22, USD: 1460.0, VND: 0.055 },
    source: 'exchangerate-api',
    apiEndpoint: 'https://api.exchangerate-api.com/v4/latest/KRW',
    fetchedAt: new Date('2025-01-19T00:00:00Z')
  }
];

async function main() {
  console.log('='.repeat(60));
  console.log('  PhotoSignature All Collections Seeder');
  console.log('='.repeat(60));

  const certPath = CERT_PATH ? join(__dirname, CERT_PATH) : null;

  const client = new MongoClient(MONGODB_URI, {
    tls: true,
    tlsCertificateKeyFile: certPath,
  });

  try {
    await client.connect();
    console.log('\n[CONNECTED] MongoDB Atlas');

    const db = client.db(DB_NAME);

    // stores
    const stores = db.collection('stores');
    await stores.deleteMany({});
    const storesResult = await stores.insertMany(dummyStores);
    console.log(`\n[stores] ${storesResult.insertedCount}개 추가`);

    // devices
    const devices = db.collection('devices');
    await devices.deleteMany({});
    const devicesResult = await devices.insertMany(dummyDevices);
    console.log(`[devices] ${devicesResult.insertedCount}개 추가`);

    // popups
    const popups = db.collection('popups');
    await popups.deleteMany({});
    const popupsResult = await popups.insertMany(dummyPopups);
    console.log(`[popups] ${popupsResult.insertedCount}개 추가`);

    // exchangeRates
    const exchangeRates = db.collection('exchangeRates');
    await exchangeRates.deleteMany({});
    const ratesResult = await exchangeRates.insertMany(dummyExchangeRates);
    console.log(`[exchangeRates] ${ratesResult.insertedCount}개 추가`);

    console.log('\n' + '-'.repeat(60));
    console.log('데이터 일관성 요약:');
    console.log('-'.repeat(60));
    console.log('  stores (9개):');
    console.log('    - 한국: 강남점, 홍대점, 부산 서면점, 대구점, 제주점');
    console.log('    - 일본: 도쿄 시부야점, 오사카점');
    console.log('    - 베트남: 호치민점');
    console.log('    - 미국: LA점');
    console.log('\n  devices (10개):');
    console.log('    - 강남점: 2대 (KIOSK_001, KIOSK_002)');
    console.log('    - 나머지 매장: 각 1대씩');
    console.log('\n  popups (3개):');
    console.log('    - Sanrio Characters 2025 (KUROMI)');
    console.log('    - Kakao Friends 2025 (RYAN)');
    console.log('    - Disney 100th Anniversary (MICKEY)');
    console.log('\n  exchangeRates (5개):');
    console.log('    - 2025-01-15 ~ 2025-01-19 (sales 날짜와 일치)');

    console.log('\n' + '='.repeat(60));
    console.log('  Seed Complete!');
    console.log('='.repeat(60));

  } catch (err) {
    console.error('\n[ERROR]', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
