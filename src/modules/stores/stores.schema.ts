// 공통 패턴: NoSQL Injection 방어용
const SAFE_ID_PATTERN = '^[a-zA-Z0-9_-]+$';
const COUNTRY_CODE_PATTERN = '^[A-Z]{2,3}$';
const PHONE_PATTERN = '^\\+?[0-9-]{10,20}$'; // E.164 및 지역 형식 호환

export const getStoresSchema = {
  querystring: {
    type: 'object',
    properties: {
      country: { type: 'string', pattern: COUNTRY_CODE_PATTERN, maxLength: 3 },
      groupId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
    },
  },
};

export const getStoreByIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
    },
  },
};

export const createStoreSchema = {
  body: {
    type: 'object',
    required: ['_id', 'name', 'group', 'country', 'settlement'],
    properties: {
      _id: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
      name: { type: 'string', maxLength: 200 },
      group: {
        type: 'object',
        required: ['id', 'name', 'grade'],
        properties: {
          id: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
          name: { type: 'string', maxLength: 200 },
          grade: { type: 'string', enum: ['MASTER', 'HIGH', 'MID', 'LOW'] },
        },
      },
      country: {
        type: 'object',
        required: ['code', 'name', 'currency'],
        properties: {
          code: { type: 'string', pattern: COUNTRY_CODE_PATTERN, maxLength: 3 },
          name: { type: 'string', maxLength: 100 },
          currency: { type: 'string', enum: ['KRW', 'JPY', 'USD', 'VND'] },
        },
      },
      owner: {
        type: 'object',
        properties: {
          phone: { type: 'string', pattern: PHONE_PATTERN, maxLength: 20 },
        },
      },
      settlement: {
        type: 'object',
        required: ['serverFeeRate', 'vatEnabled'],
        properties: {
          serverFeeRate: { type: 'number', minimum: 0, maximum: 1 },
          vatEnabled: { type: 'boolean' },
        },
      },
      kiosks: {
        type: 'array',
        items: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
        maxItems: 100,
      },
    },
  },
};

export const updateStoreSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
    },
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', maxLength: 200 },
      group: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
          name: { type: 'string', maxLength: 200 },
          grade: { type: 'string', enum: ['MASTER', 'HIGH', 'MID', 'LOW'] },
        },
      },
      country: {
        type: 'object',
        properties: {
          code: { type: 'string', pattern: COUNTRY_CODE_PATTERN, maxLength: 3 },
          name: { type: 'string', maxLength: 100 },
          currency: { type: 'string', enum: ['KRW', 'JPY', 'USD', 'VND'] },
        },
      },
      owner: {
        type: 'object',
        properties: {
          phone: { type: 'string', pattern: PHONE_PATTERN, maxLength: 20 },
        },
      },
      settlement: {
        type: 'object',
        properties: {
          serverFeeRate: { type: 'number', minimum: 0, maximum: 1 },
          vatEnabled: { type: 'boolean' },
        },
      },
      kiosks: {
        type: 'array',
        items: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
        maxItems: 100,
      },
    },
  },
};
