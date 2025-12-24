// UUID v4 패턴
const UUID_PATTERN = '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
// 안전한 ID 패턴
const SAFE_ID_PATTERN = '^[a-zA-Z0-9_-]+$';

const metricTypeEnum = ['app_start', 'capture', 'render', 'print', 'payment', 'api_call', 'screen_load'];

// 단일 성능 지표 스키마
const performanceMetricSchema = {
  type: 'object',
  required: ['timestamp', 'metricType', 'durationMs', 'success'],
  properties: {
    timestamp: { type: 'string', format: 'date-time' },
    sessionId: { type: 'string', pattern: UUID_PATTERN },
    metricType: { type: 'string', enum: metricTypeEnum },
    durationMs: { type: 'integer', minimum: 0, maximum: 600000 },  // 최대 10분
    breakdown: {
      type: 'object',
      additionalProperties: { type: 'integer', minimum: 0 },
      maxProperties: 20,
    },
    context: {
      type: 'object',
      properties: {
        memoryUsage: { type: 'number', minimum: 0, maximum: 100 },
        cpuUsage: { type: 'number', minimum: 0, maximum: 100 },
        networkType: { type: 'string', maxLength: 20 },
      },
    },
    success: { type: 'boolean' },
    errorMessage: { type: 'string', maxLength: 500 },
  },
};

// POST /api/performance - 단일 성능 기록
export const createPerformanceSchema = {
  body: {
    type: 'object',
    required: ['kioskId', 'timestamp', 'metricType', 'durationMs', 'success'],
    properties: {
      kioskId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      ...performanceMetricSchema.properties,
    },
  },
};

// POST /api/performance/batch - 배치 성능 기록
export const batchPerformanceSchema = {
  body: {
    type: 'object',
    required: ['kioskId', 'metrics'],
    properties: {
      kioskId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      metrics: {
        type: 'array',
        items: performanceMetricSchema,
        minItems: 1,
        maxItems: 50,
      },
    },
  },
};

// GET /api/performance - 성능 지표 조회
export const listPerformanceSchema = {
  querystring: {
    type: 'object',
    properties: {
      kioskId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      sessionId: { type: 'string', pattern: UUID_PATTERN },
      metricType: { type: 'string', enum: metricTypeEnum },
      startTime: { type: 'string', format: 'date-time' },
      endTime: { type: 'string', format: 'date-time' },
      limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
      offset: { type: 'integer', minimum: 0, default: 0 },
    },
  },
};
