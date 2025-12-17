// 공통 패턴: NoSQL Injection 방어용
const SAFE_ID_PATTERN = '^[a-zA-Z0-9_-]+$';
const COUNTRY_CODE_PATTERN = '^[A-Z]{2,3}$';

export const getDevicesSchema = {
  querystring: {
    type: 'object',
    properties: {
      storeId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
      country: { type: 'string', pattern: COUNTRY_CODE_PATTERN, maxLength: 3 },
    },
  },
};

export const getDeviceByIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
    },
  },
};

export const createDeviceSchema = {
  body: {
    type: 'object',
    required: ['_id', 'name', 'store', 'country', 'programType'],
    properties: {
      _id: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
      name: { type: 'string', maxLength: 200 },
      hddSerial: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$', maxLength: 100 },
      store: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
          name: { type: 'string', maxLength: 200 },
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
      programType: { type: 'string', maxLength: 50 },
    },
  },
};

export const updateDeviceSchema = {
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
      hddSerial: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$', maxLength: 100 },
      store: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
          name: { type: 'string', maxLength: 200 },
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
      programType: { type: 'string', maxLength: 50 },
    },
  },
};
