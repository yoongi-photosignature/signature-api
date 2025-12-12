export const monthlySettlementSchema = {
  querystring: {
    type: 'object',
    required: ['year', 'month'],
    properties: {
      year: { type: 'integer', minimum: 2020, maximum: 2100 },
      month: { type: 'integer', minimum: 1, maximum: 12 },
      storeId: { type: 'string' },
    },
  },
};

export const domesticSettlementSchema = {
  querystring: {
    type: 'object',
    required: ['year', 'month'],
    properties: {
      year: { type: 'integer', minimum: 2020, maximum: 2100 },
      month: { type: 'integer', minimum: 1, maximum: 12 },
    },
  },
};

export const overseasSettlementSchema = {
  querystring: {
    type: 'object',
    required: ['year', 'month'],
    properties: {
      year: { type: 'integer', minimum: 2020, maximum: 2100 },
      month: { type: 'integer', minimum: 1, maximum: 12 },
    },
  },
};
