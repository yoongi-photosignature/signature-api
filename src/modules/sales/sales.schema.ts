// UUID v4 패턴
const UUID_PATTERN = '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
// 금액 패턴 (소수점 포함)
const DECIMAL_PATTERN = '^-?\\d+(\\.\\d+)?$';
// 안전한 ID 패턴 (NoSQL Injection 방지)
const SAFE_ID_PATTERN = '^[a-zA-Z0-9_-]+$';
// 국가 코드 패턴 (2자리: KR, JP, US, VN)
const COUNTRY_CODE_PATTERN = '^[A-Z]{2}$';

export const createSaleSchema = {
  body: {
    type: 'object',
    required: ['timestamp', 'sessionId', 'transactionId', 'store', 'kiosk', 'country', 'amount', 'currency', 'amountKRW', 'rateDate', 'payment', 'product'],
    properties: {
      timestamp: { type: 'string', format: 'date-time' },
      sessionId: { type: 'string', pattern: UUID_PATTERN },
      transactionId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 100 },
      store: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
          name: { type: 'string', maxLength: 100 },
          groupId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
          groupName: { type: 'string', maxLength: 100 },
        },
      },
      kiosk: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
          name: { type: 'string', maxLength: 100 },
        },
      },
      country: {
        type: 'object',
        required: ['code', 'name'],
        properties: {
          code: { type: 'string', pattern: COUNTRY_CODE_PATTERN },
          name: { type: 'string', maxLength: 50 },
        },
      },
      amount: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
      currency: { type: 'string', enum: ['KRW', 'JPY', 'USD', 'VND'] },
      amountKRW: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
      rateDate: { type: 'string', format: 'date' },
      payment: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['CASH', 'CARD'] },
          receiptNo: { type: 'string', maxLength: 50 },
          pgProvider: { type: 'string', maxLength: 20 },
          // 필수 추가 필드 (취소/환불에 필요)
          pgTransactionId: { type: 'string', maxLength: 100 },
          approvalNo: { type: 'string', maxLength: 20 },
          // 권장 추가 필드
          installmentMonths: { type: 'integer', minimum: 0, maximum: 36 },
          terminalId: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
          // 카드 메타데이터 (PG 제공값만 저장)
          cardBrand: { type: 'string', maxLength: 20 },
          cardType: { type: 'string', enum: ['CREDIT', 'DEBIT', 'PREPAID'] },
          cardIssuer: { type: 'string', maxLength: 50 },
          cardLast4: { type: 'string', pattern: '^[0-9]{4}$' },
          // 거래 상세 (디버깅/분석용)
          pgResponseCode: { type: 'string', maxLength: 10 },
          pgErrorMessage: { type: 'string', maxLength: 500 },
        },
      },
      product: {
        type: 'object',
        required: ['type', 'frameDesign', 'frameFormat', 'printCount', 'isAdditionalPrint'],
        properties: {
          type: { type: 'string', enum: ['PHOTO', 'BEAUTY', 'AI', 'FORTUNE'] },
          frameDesign: { type: 'string', pattern: SAFE_ID_PATTERN, maxLength: 50 },
          frameFormat: { type: 'string', enum: ['3CUT', '4CUT', '6CUT', '8CUT'] },
          printCount: { type: 'integer', minimum: 1, maximum: 100 },
          isAdditionalPrint: { type: 'boolean' },
        },
      },
      discount: {
        type: 'object',
        properties: {
          roulette: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
          coupon: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
          couponCode: { type: 'string', pattern: '^[A-Z0-9-]+$', maxLength: 30 },
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
      // 선택 필드 (기본값은 서비스에서 처리)
      exchangeRate: { type: 'string', pattern: '^\\d+(\\.\\d+)?$' },
      rateSource: { type: 'string', enum: ['FIREBASE', 'CACHED', 'API_FALLBACK'] },
      // 신규 필드 (Phase 1)
      amounts: {
        type: 'object',
        required: ['gross', 'discount', 'tax', 'net', 'margin', 'currency'],
        properties: {
          gross: { type: 'string', pattern: DECIMAL_PATTERN },
          discount: { type: 'string', pattern: DECIMAL_PATTERN },
          tax: { type: 'string', pattern: DECIMAL_PATTERN },
          net: { type: 'string', pattern: DECIMAL_PATTERN },
          margin: { type: 'string', pattern: DECIMAL_PATTERN },
          currency: { type: 'string', enum: ['KRW', 'JPY', 'USD', 'VND'] },
        },
      },
      settlement: {
        type: 'object',
        required: ['status', 'scheduledDate'],
        properties: {
          status: { type: 'string', enum: ['PENDING', 'SETTLED', 'DISPUTED'] },
          scheduledDate: { type: 'string', format: 'date' },
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
