// UUID v4 패턴
const UUID_PATTERN = '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
// 안전한 ID 패턴 (NoSQL Injection 방지)
const SAFE_ID_PATTERN = '^[a-zA-Z0-9_-]+$';
// 국가 코드 패턴
const COUNTRY_CODE_PATTERN = '^[A-Z]{2,3}$';
// SemVer 패턴
const SEMVER_PATTERN = '^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.]+)?$';

const sessionStatusEnum = ['started', 'in_progress', 'completed', 'abandoned', 'timeout', 'payment_failed', 'error'];
const funnelStageEnum = ['attract', 'engage', 'customize', 'capture', 'edit', 'checkout', 'payment', 'fulfill'];
const exitReasonEnum = ['back_pressed', 'timeout', 'cancel_button', 'payment_failed', 'error', 'unknown'];
const paymentTypeEnum = ['CASH', 'CARD'];
const currencyEnum = ['KRW', 'JPY', 'USD', 'VND'];

// Stage Progress 스키마
const stageProgressSchema = {
  type: 'object',
  required: ['reached'],
  properties: {
    reached: { type: 'boolean' },
    enteredAt: { type: 'string', format: 'date-time' },
    exitedAt: { type: 'string', format: 'date-time' },
    durationMs: { type: 'integer', minimum: 0 },
  },
};

// Funnel Progress 스키마
const funnelProgressSchema = {
  type: 'object',
  required: ['stages', 'lastCompletedStage', 'exitStage', 'overallProgress'],
  properties: {
    stages: {
      type: 'object',
      properties: {
        attract: stageProgressSchema,
        engage: stageProgressSchema,
        customize: stageProgressSchema,
        capture: stageProgressSchema,
        edit: stageProgressSchema,
        checkout: stageProgressSchema,
        payment: stageProgressSchema,
        fulfill: stageProgressSchema,
      },
    },
    lastCompletedStage: { type: ['string', 'null'], enum: [...funnelStageEnum, null] },
    exitStage: { type: ['string', 'null'], enum: [...funnelStageEnum, null] },
    overallProgress: { type: 'number', minimum: 0, maximum: 1 },
  },
};

// Exit Context 스키마
const exitContextSchema = {
  type: 'object',
  required: ['reason', 'lastScreen', 'idleBeforeExitMs'],
  properties: {
    reason: { type: 'string', enum: exitReasonEnum },
    lastScreen: { type: 'string', maxLength: 100 },
    idleBeforeExitMs: { type: 'integer', minimum: 0 },
    errorMessage: { type: 'string', maxLength: 500 },
  },
};

// Selections 스키마
const selectionsSchema = {
  type: 'object',
  required: ['frameType', 'cutCount', 'background', 'character', 'filter', 'qrEnabled'],
  properties: {
    frameType: { type: ['string', 'null'], maxLength: 50 },
    cutCount: { type: 'integer', minimum: 0, maximum: 10 },
    background: { type: ['string', 'null'], maxLength: 50 },
    character: { type: ['string', 'null'], maxLength: 50 },
    filter: { type: ['string', 'null'], maxLength: 50 },
    qrEnabled: { type: 'boolean' },
  },
};

// Payment Summary 스키마
const paymentSummarySchema = {
  type: 'object',
  required: ['completed', 'method', 'amount', 'currency'],
  properties: {
    completed: { type: 'boolean' },
    method: { type: ['string', 'null'], enum: [...paymentTypeEnum, null] },
    amount: { type: 'number', minimum: 0 },
    currency: { type: 'string', enum: currencyEnum },
  },
};

// Behavior Summary 스키마
const behaviorSummarySchema = {
  type: 'object',
  required: ['totalTaps', 'totalScrolls', 'backPressCount', 'retakeCount', 'selectionChanges', 'longestIdleMs'],
  properties: {
    totalTaps: { type: 'integer', minimum: 0 },
    totalScrolls: { type: 'integer', minimum: 0 },
    backPressCount: { type: 'integer', minimum: 0 },
    retakeCount: { type: 'integer', minimum: 0 },
    selectionChanges: {
      type: 'object',
      required: ['frame', 'background', 'character', 'filter'],
      properties: {
        frame: { type: 'integer', minimum: 0 },
        background: { type: 'integer', minimum: 0 },
        character: { type: 'integer', minimum: 0 },
        filter: { type: 'integer', minimum: 0 },
      },
    },
    longestIdleMs: { type: 'integer', minimum: 0 },
  },
};

// Metadata 스키마
const metadataSchema = {
  type: 'object',
  required: ['osVersion', 'screenResolution'],
  properties: {
    osVersion: { type: 'string', maxLength: 50 },
    screenResolution: { type: 'string', pattern: '^\\d+x\\d+$' },
  },
};

// POST /api/sessions - 세션 생성
export const createSessionSchema = {
  body: {
    type: 'object',
    required: ['sessionId', 'kioskId', 'storeId', 'groupId', 'countryCode', 'appVersion', 'metadata'],
    properties: {
      sessionId: { type: 'string', pattern: UUID_PATTERN },
      kioskId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      storeId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      groupId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      countryCode: { type: 'string', pattern: COUNTRY_CODE_PATTERN },
      appVersion: { type: 'string', pattern: SEMVER_PATTERN },
      metadata: metadataSchema,
    },
  },
};

// GET /api/sessions/:sessionId - 세션 조회
export const getSessionSchema = {
  params: {
    type: 'object',
    required: ['sessionId'],
    properties: {
      sessionId: { type: 'string', pattern: UUID_PATTERN },
    },
  },
};

// PATCH /api/sessions/:sessionId - 세션 업데이트
export const updateSessionSchema = {
  params: {
    type: 'object',
    required: ['sessionId'],
    properties: {
      sessionId: { type: 'string', pattern: UUID_PATTERN },
    },
  },
  body: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: sessionStatusEnum },
      endedAt: { type: 'string', format: 'date-time' },
      durationMs: { type: 'integer', minimum: 0 },
      funnel: funnelProgressSchema,
      exitContext: exitContextSchema,
      selections: selectionsSchema,
      payment: paymentSummarySchema,
      behaviorSummary: behaviorSummarySchema,
      screenDurations: {
        type: 'object',
        additionalProperties: { type: 'integer', minimum: 0 },
        propertyNames: { pattern: '^[a-zA-Z0-9_-]+$' },
        maxProperties: 100,
      },
      experiments: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
    },
    minProperties: 1, // 최소 하나의 필드 필수
  },
};

// GET /api/sessions - 세션 목록 조회 (필터링)
export const listSessionsSchema = {
  querystring: {
    type: 'object',
    properties: {
      kioskId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      storeId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      groupId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
      status: { type: 'string', enum: sessionStatusEnum },
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      offset: { type: 'integer', minimum: 0, default: 0 },
    },
  },
};
