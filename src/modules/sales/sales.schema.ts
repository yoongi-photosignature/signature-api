export const createSaleSchema = {
  body: {
    type: 'object',
    required: ['timestamp', 'store', 'device', 'country', 'amount', 'currency', 'exchangeRate', 'amountKRW', 'rateDate', 'rateSource', 'payment', 'product'],
    properties: {
      timestamp: { type: 'string', format: 'date-time' },
      store: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          groupId: { type: 'string' },
          groupName: { type: 'string' },
        },
      },
      device: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
      },
      country: {
        type: 'object',
        required: ['code', 'name'],
        properties: {
          code: { type: 'string' },
          name: { type: 'string' },
        },
      },
      amount: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
      currency: { type: 'string', enum: ['KRW', 'JPY', 'USD', 'VND'] },
      exchangeRate: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
      amountKRW: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
      rateDate: { type: 'string', format: 'date' },
      rateSource: { type: 'string', enum: ['FIREBASE', 'CACHED', 'API_FALLBACK'] },
      payment: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['CASH', 'CARD'] },
          receiptNo: { type: 'string' },
          pgProvider: { type: 'string' },
        },
      },
      product: {
        type: 'object',
        required: ['type', 'frameId', 'frameCategory', 'printCount', 'isAdditionalPrint'],
        properties: {
          type: { type: 'string', enum: ['PHOTO', 'BEAUTY', 'AI', 'FORTUNE'] },
          frameId: { type: 'string' },
          frameCategory: { type: 'string', enum: ['3CUT', '4CUT', '6CUT', '8CUT'] },
          printCount: { type: 'integer', minimum: 1 },
          isAdditionalPrint: { type: 'boolean' },
        },
      },
      discount: {
        type: 'object',
        properties: {
          roulette: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
          coupon: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
          couponCode: { type: 'string' },
        },
      },
      popup: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          characterId: { type: 'string' },
          characterName: { type: 'string' },
          revenue: {
            type: 'object',
            properties: {
              storeRate: { type: 'number' },
              corpRate: { type: 'number' },
              licenseRate: { type: 'number' },
            },
          },
        },
      },
      services: {
        type: 'object',
        properties: {
          beauty: {
            type: 'object',
            properties: {
              used: { type: 'boolean' },
              fee: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
            },
          },
          ai: {
            type: 'object',
            properties: {
              used: { type: 'boolean' },
              fee: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
            },
          },
        },
      },
    },
  },
};

export const getSaleSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', pattern: '^[a-f\\d]{24}$' },
    },
  },
};

export const refundSaleSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', pattern: '^[a-f\\d]{24}$' },
    },
  },
  body: {
    type: 'object',
    required: ['reason', 'refundedBy'],
    properties: {
      reason: { type: 'string', minLength: 1 },
      refundedBy: { type: 'string', minLength: 1 },
    },
  },
};
