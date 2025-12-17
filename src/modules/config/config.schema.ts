// 공통 패턴: NoSQL Injection 방어용
const SAFE_ID_PATTERN = '^[a-zA-Z0-9_-]+$';

export const getConfigByIdSchema = {
  params: {
    type: 'object',
    required: ['key'],
    properties: {
      key: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
    },
  },
};

export const updateConfigSchema = {
  params: {
    type: 'object',
    required: ['key'],
    properties: {
      key: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
    },
  },
  body: {
    type: 'object',
    required: ['updatedBy'],
    properties: {
      values: {
        type: 'object',
        maxProperties: 100,
        additionalProperties: true,
      },
      domestic: { type: 'number', minimum: 0, maximum: 100 },
      overseas: { type: 'number', minimum: 0, maximum: 100 },
      provider: { type: 'string', maxLength: 100 },
      endpoint: { type: 'string', format: 'uri', maxLength: 500 },
      updateFrequency: { type: 'string', enum: ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'hourly', 'daily', 'weekly', 'monthly'] },
      updatedBy: { type: 'string', minLength: 1, maxLength: 100 },
    },
  },
};
