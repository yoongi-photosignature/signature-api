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
