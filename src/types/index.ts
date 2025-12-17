import { Decimal128, ObjectId } from 'mongodb';

// ============================================================
// Sales Types
// ============================================================

export interface SaleDocument {
  _id: ObjectId;
  timestamp: Date;
  store: {
    id: string;
    name: string;
    groupId?: string;
    groupName?: string;
  };
  device: {
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
    frameId: string;
    frameCategory: FrameCategory;
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
  createdAt: Date;
  updatedAt: Date;
}

export type Currency = 'KRW' | 'JPY' | 'USD' | 'VND';
export type RateSource = 'FIREBASE' | 'CACHED' | 'API_FALLBACK';
export type PaymentType = 'CASH' | 'CARD';
export type SaleStatus = 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type ProductType = 'PHOTO' | 'BEAUTY' | 'AI' | 'FORTUNE';
export type FrameCategory = '3CUT' | '4CUT' | '6CUT' | '8CUT';

// ============================================================
// API Input Types
// ============================================================

export interface CreateSaleInput {
  timestamp: string;
  store: {
    id: string;
    name: string;
    groupId?: string;
    groupName?: string;
  };
  device: {
    id: string;
    name: string;
  };
  country: {
    code: string;
    name: string;
  };
  amount: string;
  currency: Currency;
  exchangeRate: string;
  amountKRW: string;
  rateDate: string;
  rateSource: RateSource;
  payment: {
    type: PaymentType;
    receiptNo?: string;
    pgProvider?: string;
  };
  product: {
    type: ProductType;
    frameId: string;
    frameCategory: FrameCategory;
    printCount: number;
    isAdditionalPrint: boolean;
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
