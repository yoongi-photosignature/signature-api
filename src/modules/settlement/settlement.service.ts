import { SettlementRepository } from './settlement.repository.js';
import { MonthlySettlement, DomesticSettlement, OverseasSettlement, Currency } from '../../types/index.js';
import { fromDecimal128 } from '../../utils/decimal128.js';
import { Decimal128 } from 'mongodb';

export class SettlementService {
  constructor(private repository: SettlementRepository) {}

  async getMonthlySettlement(year: number, month: number, storeId?: string): Promise<MonthlySettlement[]> {
    const results = await this.repository.getMonthlySettlement(year, month, storeId);

    return results.map((row) => ({
      storeId: row._id as string,
      storeName: row.storeName as string,
      completedAmount: this.decimalToString(row.completedAmount),
      refundedAmount: this.decimalToString(row.refundedAmount),
      netAmount: this.decimalToString(row.netAmount),
      serverFee: this.decimalToString(row.serverFee),
      transactionCount: row.transactionCount as number,
      refundCount: row.refundCount as number,
    }));
  }

  async getDomesticSettlement(year: number, month: number): Promise<DomesticSettlement[]> {
    const results = await this.repository.getDomesticSettlement(year, month);

    return results.map((row) => ({
      storeId: row._id as string,
      storeName: row.storeName as string,
      revenue: this.decimalToString(row.revenue),
      popupRevenue: this.decimalToString(row.popupRevenue),
      beautyFee: this.decimalToString(row.beautyFee),
      serverFee: this.decimalToString(row.serverFee),
      transactionCount: row.transactionCount as number,
    }));
  }

  async getOverseasSettlement(year: number, month: number): Promise<OverseasSettlement[]> {
    const results = await this.repository.getOverseasSettlement(year, month);

    return results.map((row) => ({
      storeId: row._id as string,
      storeName: row.storeName as string,
      country: row.country as string,
      currency: row.currency as Currency,
      localRevenue: this.decimalToString(row.localRevenue),
      revenueKRW: this.decimalToString(row.revenueKRW),
      serverFee: this.decimalToString(row.serverFee),
      transactionCount: row.transactionCount as number,
    }));
  }

  private decimalToString(value: unknown): string {
    if (value instanceof Decimal128) {
      return fromDecimal128(value);
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    return '0';
  }
}
