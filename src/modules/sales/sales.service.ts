import { SalesRepository } from './sales.repository.js';
import { CreateSaleInput, RefundInput, SaleDocument, SaleTimeDimension } from '../../types/index.js';
import { toDecimal128, fromDecimal128 } from '../../utils/decimal128.js';

export class SalesService {
  constructor(private repository: SalesRepository) {}

  /**
   * ISO 주차 계산 (1-53)
   */
  private getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * 시간 차원 생성 (집계 최적화용)
   */
  private createTimeDimension(date: Date): SaleTimeDimension {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      week: this.getISOWeek(date),
      dayOfWeek: date.getDay(),
      hour: date.getHours(),
      quarter: Math.ceil((date.getMonth() + 1) / 3),
    };
  }

  async createSale(input: CreateSaleInput): Promise<string> {
    const now = new Date();
    const timestamp = new Date(input.timestamp);

    // Build sale object, only including fields that have values
    const sale: Record<string, unknown> = {
      timestamp,
      store: input.store,
      kiosk: input.kiosk,
      country: input.country,
      amount: toDecimal128(input.amount),
      currency: input.currency,
      exchangeRate: toDecimal128(input.exchangeRate),
      amountKRW: toDecimal128(input.amountKRW),
      rateDate: new Date(input.rateDate),
      rateSource: input.rateSource,
      payment: input.payment,
      status: 'COMPLETED',
      product: input.product,
      // 시간 차원 자동 생성
      timeDimension: this.createTimeDimension(timestamp),
      createdAt: now,
      updatedAt: now,
    };

    // Only add optional fields if they exist
    if (input.discount) {
      sale.discount = {
        roulette: input.discount.roulette ? toDecimal128(input.discount.roulette) : toDecimal128('0'),
        coupon: input.discount.coupon ? toDecimal128(input.discount.coupon) : toDecimal128('0'),
        ...(input.discount.couponCode && { couponCode: input.discount.couponCode }),
      };
    }

    if (input.popup) {
      sale.popup = input.popup;
    }

    if (input.services) {
      const services: Record<string, unknown> = {};
      if (input.services.beauty) {
        services.beauty = {
          used: input.services.beauty.used,
          fee: toDecimal128(input.services.beauty.fee),
        };
      }
      if (input.services.ai) {
        services.ai = {
          used: input.services.ai.used,
          fee: toDecimal128(input.services.ai.fee),
        };
      }
      if (Object.keys(services).length > 0) {
        sale.services = services;
      }
    }

    // 신규 필드: sessionId
    if (input.sessionId) {
      sale.sessionId = input.sessionId;
    }

    // 신규 필드: amounts (확장된 금액 구조)
    if (input.amounts) {
      sale.amounts = {
        gross: toDecimal128(input.amounts.gross),
        discount: toDecimal128(input.amounts.discount),
        tax: toDecimal128(input.amounts.tax),
        net: toDecimal128(input.amounts.net),
        margin: toDecimal128(input.amounts.margin),
        currency: input.amounts.currency,
      };
    }

    // 신규 필드: settlement (정산 정보)
    if (input.settlement) {
      sale.settlement = {
        status: input.settlement.status,
        scheduledDate: new Date(input.settlement.scheduledDate),
      };
    }

    const id = await this.repository.create(sale as Omit<SaleDocument, '_id'>);
    return id.toHexString();
  }

  async getSale(id: string): Promise<SaleDocument | null> {
    return this.repository.findById(id);
  }

  async processRefund(id: string, input: RefundInput): Promise<boolean> {
    const sale = await this.repository.findById(id);

    if (!sale) {
      throw new Error('Sale not found');
    }

    if (sale.status !== 'COMPLETED') {
      throw new Error('Only completed sales can be refunded');
    }

    return this.repository.updateRefund(id, {
      status: 'REFUNDED',
      refundedAt: new Date(),
      refundReason: input.reason,
      refundedBy: input.refundedBy,
      refundSnapshot: {
        originalAmount: sale.amount,
        originalAmountKRW: sale.amountKRW,
        originalStatus: sale.status,
      },
      updatedAt: new Date(),
    });
  }

  /**
   * Serialize SaleDocument for API response (Decimal128 → string)
   */
  serializeSale(sale: SaleDocument) {
    return {
      ...sale,
      _id: sale._id.toHexString(),
      amount: fromDecimal128(sale.amount),
      exchangeRate: fromDecimal128(sale.exchangeRate),
      amountKRW: fromDecimal128(sale.amountKRW),
      discount: sale.discount ? {
        roulette: fromDecimal128(sale.discount.roulette),
        coupon: fromDecimal128(sale.discount.coupon),
        couponCode: sale.discount.couponCode,
      } : undefined,
      refundSnapshot: sale.refundSnapshot ? {
        originalAmount: fromDecimal128(sale.refundSnapshot.originalAmount),
        originalAmountKRW: fromDecimal128(sale.refundSnapshot.originalAmountKRW),
        originalStatus: sale.refundSnapshot.originalStatus,
      } : undefined,
      services: sale.services ? {
        beauty: sale.services.beauty ? {
          used: sale.services.beauty.used,
          fee: fromDecimal128(sale.services.beauty.fee),
        } : undefined,
        ai: sale.services.ai ? {
          used: sale.services.ai.used,
          fee: fromDecimal128(sale.services.ai.fee),
        } : undefined,
      } : undefined,
      // 신규 필드 직렬화
      amounts: sale.amounts ? {
        gross: fromDecimal128(sale.amounts.gross),
        discount: fromDecimal128(sale.amounts.discount),
        tax: fromDecimal128(sale.amounts.tax),
        net: fromDecimal128(sale.amounts.net),
        margin: fromDecimal128(sale.amounts.margin),
        currency: sale.amounts.currency,
      } : undefined,
      settlement: sale.settlement ? {
        status: sale.settlement.status,
        scheduledDate: sale.settlement.scheduledDate?.toISOString?.() ?? sale.settlement.scheduledDate,
        processedAt: sale.settlement.processedAt?.toISOString?.() ?? sale.settlement.processedAt,
        batchId: sale.settlement.batchId,
      } : undefined,
    };
  }
}
