// UUID v4 패턴
const UUID_PATTERN = '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
// 안전한 ID 패턴
const SAFE_ID_PATTERN = '^[a-zA-Z0-9_-]+$';
// SemVer 패턴
const SEMVER_PATTERN = '^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.]+)?$';

const severityEnum = ['critical', 'error', 'warning', 'info'];
const categoryEnum = ['hardware', 'software', 'network', 'payment', 'unknown'];

// POST /api/errors - 에러 리포트
export const createErrorSchema = {
  body: {
    type: 'object',
    required: ['deviceId', 'timestamp', 'severity', 'category', 'errorCode', 'errorMessage', 'appVersion'],
    properties: {
      deviceId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      timestamp: { type: 'string', format: 'date-time' },
      sessionId: { type: 'string', pattern: UUID_PATTERN },
      severity: { type: 'string', enum: severityEnum },
      category: { type: 'string', enum: categoryEnum },
      errorCode: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      errorMessage: { type: 'string', maxLength: 1000 },
      stackTrace: { type: 'string', maxLength: 10000 },
      deviceState: {
        type: 'object',
        properties: {
          memoryUsage: { type: 'number', minimum: 0, maximum: 100 },
          cpuUsage: { type: 'number', minimum: 0, maximum: 100 },
          diskSpace: { type: 'number', minimum: 0 },
          batteryLevel: { type: 'number', minimum: 0, maximum: 100 },
          networkConnected: { type: 'boolean' },
        },
      },
      recentEvents: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            timestamp: { type: 'string', format: 'date-time' },
            eventType: { type: 'string', maxLength: 50 },
            screenName: { type: 'string', maxLength: 50 },
          },
        },
        maxItems: 50,
      },
      appVersion: { type: 'string', pattern: SEMVER_PATTERN },
    },
  },
};

// GET /api/errors - 에러 목록 조회
export const listErrorsSchema = {
  querystring: {
    type: 'object',
    properties: {
      deviceId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      sessionId: { type: 'string', pattern: UUID_PATTERN },
      severity: { type: 'string', enum: severityEnum },
      category: { type: 'string', enum: categoryEnum },
      errorCode: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      resolved: { type: 'boolean' },
      startTime: { type: 'string', format: 'date-time' },
      endTime: { type: 'string', format: 'date-time' },
      limit: { type: 'integer', minimum: 1, maximum: 500, default: 50 },
      offset: { type: 'integer', minimum: 0, default: 0 },
    },
  },
};

// GET /api/errors/:id - 에러 상세 조회
export const getErrorSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', pattern: '^[a-f\\d]{24}$' },
    },
  },
};

// PATCH /api/errors/:id/resolve - 에러 해결 표시
export const resolveErrorSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', pattern: '^[a-f\\d]{24}$' },
    },
  },
};
