import { Decimal128, ObjectId } from 'mongodb';

// ============================================================
// Sales Types
// ============================================================

// Settlement Status (정산 상태)
export type SettlementStatus = 'PENDING' | 'SETTLED' | 'DISPUTED';

// 확장된 금액 구조
export interface SaleAmounts {
  gross: Decimal128;      // 할인 전 원가
  discount: Decimal128;   // 총 할인액
  tax: Decimal128;        // 세금
  net: Decimal128;        // 최종 결제액
  margin: Decimal128;     // 본사 수익
  currency: Currency;     // 통화
}

// 정산 정보
export interface SaleSettlement {
  status: SettlementStatus;
  scheduledDate: Date;     // 예정 정산일
  processedAt?: Date;      // 실제 정산 일시
  batchId?: string;        // 정산 배치 ID
}

// 시간 차원 (집계 최적화)
export interface SaleTimeDimension {
  year: number;
  month: number;
  week: number;           // ISO week (1-53)
  dayOfWeek: number;      // 0=Sunday
  hour: number;
  quarter: number;
}

export interface SaleDocument {
  _id: ObjectId;
  timestamp: Date;
  sessionId: string;
  transactionId: string;
  store: {
    id: string;
    name: string;
    groupId?: string;
    groupName?: string;
  };
  /** Kiosk 정보 (구 device) */
  kiosk: {
    id: string;
    name: string;
  };
  country: {
    code: string;
    name: string;
  };
  amount: Decimal128;
  currency: Currency;
  exchangeRate: Decimal128;
  amountKRW: Decimal128;
  rateDate: Date;
  rateSource: RateSource;
  payment: {
    type: PaymentType;
    receiptNo?: string;
    pgProvider?: string;
    // 필수 추가 필드 (취소/환불에 필요)
    pgTransactionId?: string;
    approvalNo?: string;
    // 권장 추가 필드
    installmentMonths?: number;
    terminalId?: string;
    // 카드 메타데이터 (PG 제공값만 저장)
    cardBrand?: string;
    cardType?: 'CREDIT' | 'DEBIT' | 'PREPAID';
    cardIssuer?: string;
    cardLast4?: string;
    // 거래 상세 (디버깅/분석용)
    pgResponseCode?: string;
    pgErrorMessage?: string;
  };
  status: SaleStatus;
  failedAt?: Date;
  failReason?: string;
  refundedAt?: Date;
  refundReason?: string;
  refundedBy?: string;
  refundSnapshot?: {
    originalAmount: Decimal128;
    originalAmountKRW: Decimal128;
    originalStatus: string;
  };
  discount?: {
    roulette?: Decimal128;
    coupon?: Decimal128;
    couponCode?: string;
  };
  product: {
    type: ProductType;
    frameDesign: string;
    frameFormat: FrameFormat;
    printCount: number;
    isAdditionalPrint: boolean;
  };
  popup?: {
    id: string;
    name: string;
    characterId?: string;
    characterName?: string;
    revenue: {
      storeRate: number;
      corpRate: number;
      licenseRate: number;
    };
  };
  services?: {
    beauty?: { used: boolean; fee: Decimal128 };
    ai?: { used: boolean; fee: Decimal128 };
  };
  // 신규 필드 (Phase 1)
  amounts?: SaleAmounts;        // 확장된 금액 구조
  settlement?: SaleSettlement;  // 정산 정보
  timeDimension?: SaleTimeDimension;  // 시간 차원
  createdAt: Date;
  updatedAt: Date;
}

export type Currency = 'KRW' | 'JPY' | 'USD' | 'VND';
export type RateSource = 'FIREBASE' | 'CACHED' | 'API_FALLBACK';
export type PaymentType = 'CASH' | 'CARD';
export type SaleStatus = 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type ProductType = 'PHOTO' | 'BEAUTY' | 'AI' | 'FORTUNE';
export type FrameFormat = '3CUT' | '4CUT' | '6CUT' | '8CUT';

// ============================================================
// API Input Types
// ============================================================

// CreateSaleInput용 금액 구조 (string으로 입력)
export interface CreateSaleAmountsInput {
  gross: string;
  discount: string;
  tax: string;
  net: string;
  margin: string;
  currency: Currency;
}

// CreateSaleInput용 정산 정보
export interface CreateSaleSettlementInput {
  status: SettlementStatus;
  scheduledDate: string;
}

export interface CreateSaleInput {
  timestamp: string;
  sessionId: string;
  transactionId: string;
  store: {
    id: string;
    name: string;
    groupId?: string;
    groupName?: string;
  };
  /** Kiosk 정보 (구 device) */
  kiosk: {
    id: string;
    name: string;
  };
  country: {
    code: string;
    name: string;
  };
  amount: string;
  currency: Currency;
  exchangeRate?: string;  // 선택, 기본값 "1"
  amountKRW: string;
  rateDate: string;
  rateSource?: RateSource;  // 선택, 기본값 "FIREBASE"
  payment: {
    type: PaymentType;
    receiptNo?: string;
    pgProvider?: string;
    pgTransactionId?: string;
    approvalNo?: string;
    installmentMonths?: number;
    terminalId?: string;
    cardBrand?: string;
    cardType?: 'CREDIT' | 'DEBIT' | 'PREPAID';
    cardIssuer?: string;
    cardLast4?: string;
    pgResponseCode?: string;
    pgErrorMessage?: string;
  };
  product: {
    type: ProductType;
    frameDesign: string;
    frameFormat: FrameFormat;
    printCount?: number;         // 선택, 기본값 1
    isAdditionalPrint?: boolean; // 선택, 기본값 false
  };
  discount?: {
    roulette?: string;
    coupon?: string;
    couponCode?: string;
  };
  popup?: {
    id: string;
    name: string;
    characterId?: string;
    characterName?: string;
    revenue: {
      storeRate: number;
      corpRate: number;
      licenseRate: number;
    };
  };
  services?: {
    beauty?: { used: boolean; fee: string };
    ai?: { used: boolean; fee: string };
  };
  // 신규 필드 (Phase 1)
  amounts?: CreateSaleAmountsInput;
  settlement?: CreateSaleSettlementInput;
}

export interface RefundInput {
  reason: string;
  refundedBy: string;
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================
// Settlement Types
// ============================================================

export interface MonthlySettlement {
  storeId: string;
  storeName: string;
  completedAmount: string;
  refundedAmount: string;
  netAmount: string;
  serverFee: string;
  transactionCount: number;
  refundCount: number;
}

export interface DomesticSettlement {
  storeId: string;
  storeName: string;
  revenue: string;
  popupRevenue: string;
  beautyFee: string;
  serverFee: string;
  transactionCount: number;
}

export interface OverseasSettlement {
  storeId: string;
  storeName: string;
  country: string;
  currency: Currency;
  localRevenue: string;
  revenueKRW: string;
  serverFee: string;
  transactionCount: number;
}

// ============================================================
// Exchange Rate Types
// ============================================================

export interface ExchangeRateDocument {
  _id: string; // date string: "2025-01-15"
  baseCurrency: string;
  rates: Record<string, number>;
  source: string;
  apiEndpoint: string;
  fetchedAt: Date;
}

export interface ExchangeRateResponse {
  date: string;
  baseCurrency: string;
  rates: Record<string, number>;
  source: string;
  fetchedAt: string;
}

// ============================================================
// Popup Types
// ============================================================

export type PopupStatus = 'SCHEDULED' | 'ACTIVE' | 'ENDED';
export type DiscountType = 'ROULETTE' | 'COUPON' | 'FIXED' | 'NONE';

export interface PopupDocument {
  _id: string;
  name: string;
  character?: {
    id: string;
    name: string;
    code: string;
  };
  status: PopupStatus;
  period: {
    start: Date;
    end: Date;
  };
  endedAt?: Date;
  countries: string[];
  revenueConfig: {
    storeRate: number;
    corpRate: number;
    licenseRate: number;
  };
  discountConfig?: {
    type: DiscountType;
    rouletteRates?: number[];
    maxDiscount?: number;
  };
  pricing?: Record<string, { price: number; printCount: number }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePopupInput {
  _id: string;
  name: string;
  character?: {
    id: string;
    name: string;
    code: string;
  };
  status: PopupStatus;
  period: {
    start: string;
    end: string;
  };
  countries: string[];
  revenueConfig: {
    storeRate: number;
    corpRate: number;
    licenseRate: number;
  };
  discountConfig?: {
    type: DiscountType;
    rouletteRates?: number[];
    maxDiscount?: string;
  };
  pricing?: Record<string, { price: string; printCount: number }>;
}

export interface UpdatePopupInput {
  name?: string;
  character?: {
    id: string;
    name: string;
    code: string;
  };
  period?: {
    start: string;
    end: string;
  };
  countries?: string[];
  revenueConfig?: {
    storeRate: number;
    corpRate: number;
    licenseRate: number;
  };
  discountConfig?: {
    type: DiscountType;
    rouletteRates?: number[];
    maxDiscount?: string;
  };
  pricing?: Record<string, { price: string; printCount: number }>;
}

// ============================================================
// Store Types
// ============================================================

export type GroupGrade = 'MASTER' | 'HIGH' | 'MID' | 'LOW';

export interface StoreDocument {
  _id: string;
  name: string;
  group: {
    id: string;
    name: string;
    grade: GroupGrade;
  };
  country: {
    code: string;
    name: string;
    currency: Currency;
  };
  owner?: {
    phone: string;
  };
  settlement: {
    serverFeeRate: number;
    vatEnabled: boolean;
  };
  devices: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStoreInput {
  _id: string;
  name: string;
  group: {
    id: string;
    name: string;
    grade: GroupGrade;
  };
  country: {
    code: string;
    name: string;
    currency: Currency;
  };
  owner?: {
    phone: string;
  };
  settlement: {
    serverFeeRate: number;
    vatEnabled: boolean;
  };
  devices?: string[];
}

export interface UpdateStoreInput {
  name?: string;
  group?: {
    id: string;
    name: string;
    grade: GroupGrade;
  };
  country?: {
    code: string;
    name: string;
    currency: Currency;
  };
  owner?: {
    phone: string;
  };
  settlement?: {
    serverFeeRate: number;
    vatEnabled: boolean;
  };
  devices?: string[];
}

// ============================================================
// Device Types
// ============================================================

export interface DeviceDocument {
  _id: string;
  name: string;
  hddSerial?: string;
  store: {
    id: string;
    name: string;
  };
  country: {
    code: string;
    name: string;
    currency: Currency;
  };
  programType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDeviceInput {
  _id: string;
  name: string;
  hddSerial?: string;
  store: {
    id: string;
    name: string;
  };
  country: {
    code: string;
    name: string;
    currency: Currency;
  };
  programType: string;
}

export interface UpdateDeviceInput {
  name?: string;
  hddSerial?: string;
  store?: {
    id: string;
    name: string;
  };
  country?: {
    code: string;
    name: string;
    currency: Currency;
  };
  programType?: string;
}

// ============================================================
// Session Types
// ============================================================

export type SessionStatus =
  | 'started'
  | 'in_progress'
  | 'completed'
  | 'abandoned'
  | 'timeout'
  | 'payment_failed'
  | 'error';

export type FunnelStage =
  | 'attract'
  | 'engage'
  | 'customize'
  | 'capture'
  | 'edit'
  | 'checkout'
  | 'payment'
  | 'fulfill';

export interface StageProgress {
  reached: boolean;
  enteredAt?: Date;
  exitedAt?: Date;
  durationMs?: number;
}

export interface FunnelProgress {
  stages: Record<FunnelStage, StageProgress>;
  lastCompletedStage: FunnelStage | null;
  exitStage: FunnelStage | null;
  overallProgress: number;
}

export interface ExitContext {
  reason: 'back_pressed' | 'timeout' | 'cancel_button' | 'payment_failed' | 'error' | 'unknown';
  lastScreen: string;
  idleBeforeExitMs: number;
  errorMessage?: string;
}

export interface SessionSelections {
  frameType: string | null;
  cutCount: number;
  background: string | null;
  character: string | null;
  filter: string | null;
  qrEnabled: boolean;
}

export interface PaymentSummary {
  completed: boolean;
  method: PaymentType | null;
  amount: number;
  currency: Currency;
}

export interface BehaviorSummary {
  totalTaps: number;
  totalScrolls: number;
  backPressCount: number;
  retakeCount: number;
  selectionChanges: {
    frame: number;
    background: number;
    character: number;
    filter: number;
  };
  longestIdleMs: number;
}

export interface SessionDocument {
  _id?: ObjectId;
  sessionId: string;
  /** Kiosk 식별자 (구 deviceId) */
  kioskId: string;
  storeId: string;
  groupId: string;
  countryCode: string;
  kioskVersion: string;
  launcherVersion: string;
  startedAt: Date;
  endedAt: Date | null;
  durationMs: number | null;
  status: SessionStatus;
  funnel: FunnelProgress;
  exitContext?: ExitContext;
  selections: SessionSelections;
  payment?: PaymentSummary;
  behaviorSummary: BehaviorSummary;
  screenDurations: Record<string, number>;
  experiments?: Record<string, string>;
  metadata: {
    osVersion: string;
    screenResolution: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionInput {
  sessionId: string;
  /** Kiosk 식별자 (구 deviceId) */
  kioskId: string;
  storeId: string;
  groupId: string;
  countryCode: string;
  kioskVersion: string;
  launcherVersion: string;
  metadata: {
    osVersion: string;
    screenResolution: string;
  };
}

export interface UpdateSessionInput {
  status?: SessionStatus;
  endedAt?: string;
  durationMs?: number;
  funnel?: FunnelProgress;
  exitContext?: ExitContext;
  selections?: SessionSelections;
  payment?: PaymentSummary;
  behaviorSummary?: BehaviorSummary;
  screenDurations?: Record<string, number>;
  experiments?: Record<string, string>;
}

// ============================================================
// Event Types (Time-Series)
// ============================================================

export type EventType =
  | 'screen_enter'
  | 'screen_exit'
  | 'tap'
  | 'long_press'
  | 'select'
  | 'deselect'
  | 'back'
  | 'cancel'
  | 'scroll'
  | 'capture'
  | 'retake'
  | 'payment_start'
  | 'payment_complete'
  | 'payment_fail'
  | 'print_start'
  | 'print_complete'
  | 'error';

export interface EventDocument {
  _id?: ObjectId;
  timestamp: Date;
  /** Kiosk 식별자 (구 deviceId) */
  kioskId: string;
  sessionId: string;
  sequenceNo: number;
  eventType: EventType;
  screenName: string;
  targetId?: string;
  targetType?: string;
  position?: {
    x: number;
    y: number;
  };
  value?: string | number | boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateEventInput {
  timestamp: string;
  sessionId: string;
  sequenceNo: number;
  eventType: EventType;
  screenName: string;
  targetId?: string;
  targetType?: string;
  position?: {
    x: number;
    y: number;
  };
  value?: string | number | boolean;
  metadata?: Record<string, unknown>;
}

export interface BatchEventsInput {
  /** Kiosk 식별자 (구 deviceId) */
  kioskId: string;
  events: CreateEventInput[];
}

// ============================================================
// Performance Types (Time-Series)
// ============================================================

export type MetricType =
  | 'app_start'
  | 'capture'
  | 'render'
  | 'print'
  | 'payment'
  | 'api_call'
  | 'screen_load';

export interface PerformanceDocument {
  _id?: ObjectId;
  timestamp: Date;
  /** Kiosk 식별자 (구 deviceId) */
  kioskId: string;
  sessionId?: string;
  metricType: MetricType;
  durationMs: number;
  breakdown?: Record<string, number>;
  context?: {
    memoryUsage?: number;
    cpuUsage?: number;
    networkType?: string;
  };
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}

export interface CreatePerformanceInput {
  timestamp: string;
  sessionId?: string;
  metricType: MetricType;
  durationMs: number;
  breakdown?: Record<string, number>;
  context?: {
    memoryUsage?: number;
    cpuUsage?: number;
    networkType?: string;
  };
  success: boolean;
  errorMessage?: string;
}

export interface BatchPerformanceInput {
  /** Kiosk 식별자 (구 deviceId) */
  kioskId: string;
  metrics: CreatePerformanceInput[];
}

// ============================================================
// Error Types
// ============================================================

export type ErrorSeverity = 'critical' | 'error' | 'warning' | 'info';
export type ErrorCategory = 'hardware' | 'software' | 'network' | 'payment' | 'unknown';

export interface ErrorDocument {
  _id?: ObjectId;
  timestamp: Date;
  /** Kiosk 식별자 (구 deviceId) */
  kioskId: string;
  sessionId?: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  errorCode: string;
  errorMessage: string;
  stackTrace?: string;
  deviceState?: {
    memoryUsage?: number;
    cpuUsage?: number;
    diskSpace?: number;
    batteryLevel?: number;
    networkConnected?: boolean;
  };
  recentEvents?: Array<{
    timestamp: string;
    eventType: string;
    screenName: string;
  }>;
  appVersion: string;
  resolved: boolean;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface CreateErrorInput {
  timestamp: string;
  sessionId?: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  errorCode: string;
  errorMessage: string;
  stackTrace?: string;
  deviceState?: {
    memoryUsage?: number;
    cpuUsage?: number;
    diskSpace?: number;
    batteryLevel?: number;
    networkConnected?: boolean;
  };
  recentEvents?: Array<{
    timestamp: string;
    eventType: string;
    screenName: string;
  }>;
  appVersion: string;
}

// ============================================================
// Daily Summary Types
// ============================================================

export interface DailySummaryDocument {
  _id?: ObjectId;
  date: string;  // YYYY-MM-DD
  /** Kiosk 식별자 (구 deviceId) */
  kioskId: string;
  storeId: string;
  groupId: string;
  countryCode: string;

  // 세션 통계
  sessions: {
    total: number;
    completed: number;
    abandoned: number;
    timeout: number;
    avgDurationMs: number;
  };

  // 퍼널 통계
  funnel: {
    attract: number;
    engage: number;
    customize: number;
    capture: number;
    edit: number;
    checkout: number;
    payment: number;
    fulfill: number;
    conversionRate: number;
  };

  // 매출 통계
  sales: {
    totalCount: number;
    totalAmount: number;
    avgAmount: number;
    byPaymentType: {
      cash: { count: number; amount: number };
      card: { count: number; amount: number };
    };
    refundCount: number;
    refundAmount: number;
  };

  // 성능 통계
  performance: {
    appStart: { p50: number; p95: number; p99: number };
    capture: { p50: number; p95: number; p99: number };
    render: { p50: number; p95: number; p99: number };
    print: { p50: number; p95: number; p99: number };
    payment: { p50: number; p95: number; p99: number };
  };

  // 에러 통계
  errors: {
    total: number;
    bySeverity: {
      critical: number;
      error: number;
      warning: number;
    };
    byCategory: {
      hardware: number;
      software: number;
      network: number;
      payment: number;
    };
  };

  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Config Types
// ============================================================

export interface ConfigDocument {
  _id: string;
  values?: Record<string, unknown>;
  domestic?: number;
  overseas?: number;
  provider?: string;
  endpoint?: string;
  updateFrequency?: string;
  lastUpdated?: Date;
  updatedAt: Date;
  updatedBy: string;
}
