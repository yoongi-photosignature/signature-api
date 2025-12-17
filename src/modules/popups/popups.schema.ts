// 공통 패턴: NoSQL Injection 방어용
const SAFE_ID_PATTERN = '^[a-zA-Z0-9_-]+$';
const SAFE_STRING_PATTERN = '^[^${}]+$'; // MongoDB 연산자 차단

export const getPopupsSchema = {
  querystring: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['SCHEDULED', 'ACTIVE', 'ENDED'] },
    },
  },
};

export const getPopupByIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
    },
  },
};

export const createPopupSchema = {
  body: {
    type: 'object',
    required: ['_id', 'name', 'status', 'period', 'countries', 'revenueConfig'],
    properties: {
      _id: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
      name: { type: 'string', maxLength: 200 },
      character: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
          name: { type: 'string', maxLength: 100 },
          code: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
        },
      },
      status: { type: 'string', enum: ['SCHEDULED', 'ACTIVE', 'ENDED'] },
      period: {
        type: 'object',
        required: ['start', 'end'],
        properties: {
          start: { type: 'string', format: 'date' },
          end: { type: 'string', format: 'date' },
        },
      },
      countries: {
        type: 'array',
        items: { type: 'string', pattern: '^[A-Z]{2,3}$|^ALL$', maxLength: 10 },
        minItems: 1,
        maxItems: 50,
      },
      revenueConfig: {
        type: 'object',
        required: ['storeRate', 'corpRate', 'licenseRate'],
        properties: {
          storeRate: { type: 'number', minimum: 0, maximum: 1 },
          corpRate: { type: 'number', minimum: 0, maximum: 1 },
          licenseRate: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
      discountConfig: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['ROULETTE', 'COUPON', 'FIXED', 'NONE'] },
          rouletteRates: { type: 'array', items: { type: 'number', minimum: 0, maximum: 100 }, maxItems: 10 },
          maxDiscount: { type: 'string', pattern: '^\\d+(\\.\\d+)?$', maxLength: 20 },
        },
      },
      pricing: {
        type: 'object',
        maxProperties: 20,
        additionalProperties: {
          type: 'object',
          properties: {
            price: { type: 'string', pattern: '^\\d+(\\.\\d+)?$', maxLength: 20 },
            printCount: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
      },
    },
  },
};

export const updatePopupSchema = {
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
      character: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
          name: { type: 'string', maxLength: 100 },
          code: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
        },
      },
      period: {
        type: 'object',
        properties: {
          start: { type: 'string', format: 'date' },
          end: { type: 'string', format: 'date' },
        },
      },
      countries: {
        type: 'array',
        items: { type: 'string', pattern: '^[A-Z]{2,3}$|^ALL$', maxLength: 10 },
        minItems: 1,
        maxItems: 50,
      },
      revenueConfig: {
        type: 'object',
        properties: {
          storeRate: { type: 'number', minimum: 0, maximum: 1 },
          corpRate: { type: 'number', minimum: 0, maximum: 1 },
          licenseRate: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
      discountConfig: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['ROULETTE', 'COUPON', 'FIXED', 'NONE'] },
          rouletteRates: { type: 'array', items: { type: 'number', minimum: 0, maximum: 100 }, maxItems: 10 },
          maxDiscount: { type: 'string', pattern: '^\\d+(\\.\\d+)?$', maxLength: 20 },
        },
      },
      pricing: {
        type: 'object',
        maxProperties: 20,
        additionalProperties: {
          type: 'object',
          properties: {
            price: { type: 'string', pattern: '^\\d+(\\.\\d+)?$', maxLength: 20 },
            printCount: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
      },
    },
  },
};

export const updatePopupStatusSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
    },
  },
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['SCHEDULED', 'ACTIVE', 'ENDED'] },
    },
  },
};
