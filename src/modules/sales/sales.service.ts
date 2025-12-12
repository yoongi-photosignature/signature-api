import { SalesRepository } from './sales.repository.js';
import { CreateSaleInput, RefundInput, SaleDocument } from '../../types/index.js';
import { toDecimal128, fromDecimal128 } from '../../utils/decimal128.js';

export class SalesService {
  constructor(private repository: SalesRepository) {}

  async createSale(input: CreateSaleInput): Promise<string> {
    const now = new Date();

    // Build sale object, only including fields that have values
    const sale: Record<string, unknown> = {
      timestamp: new Date(input.timestamp),
      store: input.store,
      device: input.device,
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
    };
  }
}
