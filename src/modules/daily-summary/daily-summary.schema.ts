// 안전한 ID 패턴
const SAFE_ID_PATTERN = '^[a-zA-Z0-9_-]+$';
// 날짜 패턴 (YYYY-MM-DD)
const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';

// GET /api/daily-summary - 일일 요약 조회
export const listDailySummarySchema = {
  querystring: {
    type: 'object',
    properties: {
      kioskId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      storeId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      groupId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      startDate: { type: 'string', pattern: DATE_PATTERN },
      endDate: { type: 'string', pattern: DATE_PATTERN },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
      offset: { type: 'integer', minimum: 0, default: 0 },
    },
  },
};

// GET /api/daily-summary/:date/:kioskId - 특정 일일 요약 조회
export const getDailySummarySchema = {
  params: {
    type: 'object',
    required: ['date', 'kioskId'],
    properties: {
      date: { type: 'string', pattern: DATE_PATTERN },
      kioskId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
    },
  },
};

// POST /api/daily-summary/aggregate - 수동 집계 실행
export const triggerAggregationSchema = {
  body: {
    type: 'object',
    required: ['date'],
    properties: {
      date: { type: 'string', pattern: DATE_PATTERN },
      kioskId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
    },
  },
};
