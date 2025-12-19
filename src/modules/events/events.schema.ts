// UUID v4 패턴
const UUID_PATTERN = '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
// 안전한 ID 패턴 (NoSQL Injection 방지)
const SAFE_ID_PATTERN = '^[a-zA-Z0-9_-]+$';

const eventTypeEnum = [
  'screen_enter', 'screen_exit', 'tap', 'long_press',
  'select', 'deselect', 'back', 'cancel', 'scroll',
  'capture', 'retake', 'payment_start', 'payment_complete',
  'payment_fail', 'print_start', 'print_complete', 'error'
];

// 단일 이벤트 스키마
const eventSchema = {
  type: 'object',
  required: ['timestamp', 'sessionId', 'sequenceNo', 'eventType', 'screenName'],
  properties: {
    timestamp: { type: 'string', format: 'date-time' },
    sessionId: { type: 'string', pattern: UUID_PATTERN },
    sequenceNo: { type: 'integer', minimum: 0 },
    eventType: { type: 'string', enum: eventTypeEnum },
    screenName: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
    targetId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
    targetType: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 30 },
    position: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
      },
    },
    value: {
      oneOf: [
        { type: 'string', maxLength: 200 },
        { type: 'number' },
        { type: 'boolean' },
      ],
    },
    metadata: {
      type: 'object',
      additionalProperties: {
        oneOf: [
          { type: 'string', maxLength: 500 },
          { type: 'number' },
          { type: 'boolean' },
        ],
      },
      maxProperties: 20,
    },
  },
};

// POST /api/events/batch - 이벤트 배치 삽입
export const batchEventsSchema = {
  body: {
    type: 'object',
    required: ['deviceId', 'events'],
    properties: {
      deviceId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      events: {
        type: 'array',
        items: eventSchema,
        minItems: 1,
        maxItems: 100,  // 최대 100개까지 배치
      },
    },
  },
};

// GET /api/events/session/:sessionId - 세션별 이벤트 조회
export const getSessionEventsSchema = {
  params: {
    type: 'object',
    required: ['sessionId'],
    properties: {
      sessionId: { type: 'string', pattern: UUID_PATTERN },
    },
  },
};

// GET /api/events - 이벤트 조회 (필터링)
export const listEventsSchema = {
  querystring: {
    type: 'object',
    properties: {
      sessionId: { type: 'string', pattern: UUID_PATTERN },
      deviceId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      eventType: { type: 'string', enum: eventTypeEnum },
      startTime: { type: 'string', format: 'date-time' },
      endTime: { type: 'string', format: 'date-time' },
      limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
      offset: { type: 'integer', minimum: 0, default: 0 },
    },
  },
};
