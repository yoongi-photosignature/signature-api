import { Collection, Db } from 'mongodb';
import { SaleDocument } from '../../types/index.js';

export class SettlementRepository {
  private salesCollection: Collection<SaleDocument>;

  constructor(db: Db) {
    this.salesCollection = db.collection('sales');
  }

  /**
   * 월간 정산 (매장별)
   * - COMPLETED: 해당 월 매출
   * - REFUNDED: 해당 월 환불 (차감)
   */
  async getMonthlySettlement(year: number, month: number, storeId?: string) {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    const matchStage: Record<string, unknown> = {
      $or: [
        { timestamp: { $gte: startDate, $lt: endDate }, status: 'COMPLETED' },
        { refundedAt: { $gte: startDate, $lt: endDate }, status: 'REFUNDED' },
      ],
    };

    if (storeId) {
      matchStage['store.id'] = storeId;
    }

    return this.salesCollection.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$store.id',
          storeName: { $first: '$store.name' },
          completedAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, '$amountKRW', 0] },
          },
          refundedAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'REFUNDED'] }, '$refundSnapshot.originalAmountKRW', 0] },
          },
          transactionCount: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] },
          },
          refundCount: {
            $sum: { $cond: [{ $eq: ['$status', 'REFUNDED'] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'stores',
          localField: '_id',
          foreignField: '_id',
          as: 'storeInfo',
        },
      },
      {
        $addFields: {
          serverFeeRate: { $ifNull: [{ $arrayElemAt: ['$storeInfo.settlement.serverFeeRate', 0] }, 0.07] },
          netAmount: { $subtract: ['$completedAmount', '$refundedAmount'] },
        },
      },
      {
        $addFields: {
          serverFee: { $multiply: ['$netAmount', '$serverFeeRate'] },
        },
      },
      { $project: { storeInfo: 0, serverFeeRate: 0 } },
      { $sort: { netAmount: -1 } },
    ], { readConcern: { level: 'majority' } }).toArray();
  }

  /**
   * 국내 정산 (KOR)
   * - 팝업 매출, 뷰티 서비스 수수료 포함
   */
  async getDomesticSettlement(year: number, month: number) {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    return this.salesCollection.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lt: endDate },
          'country.code': 'KOR',
          status: 'COMPLETED',
        },
      },
      {
        $group: {
          _id: '$store.id',
          storeName: { $first: '$store.name' },
          revenue: { $sum: '$amountKRW' },
          popupRevenue: {
            $sum: { $cond: [{ $ne: ['$popup', null] }, '$amountKRW', 0] },
          },
          beautyFee: { $sum: { $ifNull: ['$services.beauty.fee', 0] } },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'stores',
          localField: '_id',
          foreignField: '_id',
          as: 'storeInfo',
        },
      },
      {
        $addFields: {
          serverFeeRate: { $ifNull: [{ $arrayElemAt: ['$storeInfo.settlement.serverFeeRate', 0] }, 0.07] },
        },
      },
      {
        $addFields: {
          serverFee: { $multiply: ['$revenue', '$serverFeeRate'] },
        },
      },
      { $project: { storeInfo: 0, serverFeeRate: 0 } },
      { $sort: { revenue: -1 } },
    ], { readConcern: { level: 'majority' } }).toArray();
  }

  /**
   * 해외 정산 (non-KOR)
   * - 국가별, 현지 통화 및 KRW 환산 금액
   */
  async getOverseasSettlement(year: number, month: number) {
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    return this.salesCollection.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lt: endDate },
          'country.code': { $ne: 'KOR' },
          status: 'COMPLETED',
        },
      },
      {
        $group: {
          _id: '$store.id',
          storeName: { $first: '$store.name' },
          country: { $first: '$country.code' },
          currency: { $first: '$currency' },
          localRevenue: { $sum: '$amount' },
          revenueKRW: { $sum: '$amountKRW' },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'stores',
          localField: '_id',
          foreignField: '_id',
          as: 'storeInfo',
        },
      },
      {
        $addFields: {
          serverFeeRate: { $ifNull: [{ $arrayElemAt: ['$storeInfo.settlement.serverFeeRate', 0] }, 0.04] },
        },
      },
      {
        $addFields: {
          serverFee: { $multiply: ['$revenueKRW', '$serverFeeRate'] },
        },
      },
      { $project: { storeInfo: 0, serverFeeRate: 0 } },
      { $sort: { revenueKRW: -1 } },
    ], { readConcern: { level: 'majority' } }).toArray();
  }
}
