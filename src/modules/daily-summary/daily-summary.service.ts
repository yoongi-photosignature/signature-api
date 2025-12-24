import { Db } from 'mongodb';
import { DailySummaryRepository, DailySummaryFilter } from './daily-summary.repository.js';
import { DailySummaryDocument, FunnelStage } from '../../types/index.js';

export class DailySummaryService {
  private repository: DailySummaryRepository;
  private db: Db;

  constructor(db: Db) {
    this.repository = new DailySummaryRepository(db);
    this.db = db;
  }

  /**
   * 특정 날짜/키오스크의 일일 요약 조회
   */
  async getSummary(date: string, kioskId: string): Promise<DailySummaryDocument | null> {
    return this.repository.findOne(date, kioskId);
  }

  /**
   * 일일 요약 목록 조회
   */
  async listSummaries(
    filter: DailySummaryFilter,
    limit: number = 30,
    offset: number = 0
  ): Promise<{ summaries: DailySummaryDocument[]; total: number }> {
    const [summaries, total] = await Promise.all([
      this.repository.findMany(filter, limit, offset),
      this.repository.count(filter),
    ]);

    return { summaries, total };
  }

  /**
   * 특정 날짜의 집계 실행
   */
  async aggregate(date: string, kioskId?: string): Promise<number> {
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    // 해당 날짜에 세션이 있는 키오스크 목록 조회
    const sessionsCollection = this.db.collection('sessions');
    const query = kioskId
      ? { kioskId, startedAt: { $gte: startOfDay, $lte: endOfDay } }
      : { startedAt: { $gte: startOfDay, $lte: endOfDay } };

    const kiosks = await sessionsCollection.distinct('kioskId', query);

    // 병렬 처리로 성능 개선 (배치 단위: 10개)
    const BATCH_SIZE = 10;
    let aggregatedCount = 0;

    for (let i = 0; i < kiosks.length; i += BATCH_SIZE) {
      const batch = kiosks.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(kId => this.aggregateKiosk(date, kId as string, startOfDay, endOfDay))
      );
      aggregatedCount += batch.length;
    }

    return aggregatedCount;
  }

  /**
   * 특정 키오스크의 일일 집계
   */
  private async aggregateKiosk(
    date: string,
    kioskId: string,
    startOfDay: Date,
    endOfDay: Date
  ): Promise<void> {
    // 세션 통계
    const sessionStats = await this.aggregateSessions(kioskId, startOfDay, endOfDay);

    // 퍼널 통계
    const funnelStats = await this.aggregateFunnel(kioskId, startOfDay, endOfDay);

    // 매출 통계
    const salesStats = await this.aggregateSales(kioskId, startOfDay, endOfDay);

    // 성능 통계
    const performanceStats = await this.aggregatePerformance(kioskId, startOfDay, endOfDay);

    // 에러 통계
    const errorStats = await this.aggregateErrors(kioskId, startOfDay, endOfDay);

    // 키오스크 메타데이터 조회
    const kioskMeta = await this.getKioskMetadata(kioskId);

    const summary: Omit<DailySummaryDocument, '_id'> = {
      date,
      kioskId,
      storeId: kioskMeta.storeId,
      groupId: kioskMeta.groupId,
      countryCode: kioskMeta.countryCode,
      sessions: sessionStats,
      funnel: funnelStats,
      sales: salesStats,
      performance: performanceStats,
      errors: errorStats,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.repository.upsert(summary);
  }

  /**
   * 세션 통계 집계
   */
  private async aggregateSessions(kioskId: string, startOfDay: Date, endOfDay: Date) {
    const collection = this.db.collection('sessions');

    const pipeline = [
      {
        $match: {
          kioskId,
          startedAt: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          abandoned: { $sum: { $cond: [{ $eq: ['$status', 'abandoned'] }, 1, 0] } },
          timeout: { $sum: { $cond: [{ $eq: ['$status', 'timeout'] }, 1, 0] } },
          avgDurationMs: { $avg: '$durationMs' },
        },
      },
    ];

    const [result] = await collection.aggregate(pipeline).toArray();

    return {
      total: result?.total || 0,
      completed: result?.completed || 0,
      abandoned: result?.abandoned || 0,
      timeout: result?.timeout || 0,
      avgDurationMs: Math.round(result?.avgDurationMs || 0),
    };
  }

  /**
   * 퍼널 통계 집계
   */
  private async aggregateFunnel(kioskId: string, startOfDay: Date, endOfDay: Date) {
    const collection = this.db.collection('sessions');
    const stages: FunnelStage[] = ['attract', 'engage', 'customize', 'capture', 'edit', 'checkout', 'payment', 'fulfill'];

    const pipeline = [
      {
        $match: {
          kioskId,
          startedAt: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: null,
          attract: { $sum: { $cond: ['$funnel.stages.attract.reached', 1, 0] } },
          engage: { $sum: { $cond: ['$funnel.stages.engage.reached', 1, 0] } },
          customize: { $sum: { $cond: ['$funnel.stages.customize.reached', 1, 0] } },
          capture: { $sum: { $cond: ['$funnel.stages.capture.reached', 1, 0] } },
          edit: { $sum: { $cond: ['$funnel.stages.edit.reached', 1, 0] } },
          checkout: { $sum: { $cond: ['$funnel.stages.checkout.reached', 1, 0] } },
          payment: { $sum: { $cond: ['$funnel.stages.payment.reached', 1, 0] } },
          fulfill: { $sum: { $cond: ['$funnel.stages.fulfill.reached', 1, 0] } },
        },
      },
    ];

    const [result] = await collection.aggregate(pipeline).toArray();

    const attract = result?.attract || 0;
    const fulfill = result?.fulfill || 0;
    const conversionRate = attract > 0 ? fulfill / attract : 0;

    return {
      attract,
      engage: result?.engage || 0,
      customize: result?.customize || 0,
      capture: result?.capture || 0,
      edit: result?.edit || 0,
      checkout: result?.checkout || 0,
      payment: result?.payment || 0,
      fulfill,
      conversionRate: Math.round(conversionRate * 10000) / 10000,  // 소수점 4자리
    };
  }

  /**
   * 매출 통계 집계
   */
  private async aggregateSales(kioskId: string, startOfDay: Date, endOfDay: Date) {
    const collection = this.db.collection('sales');

    const pipeline = [
      {
        $match: {
          'kiosk.id': kioskId,
          timestamp: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          totalAmount: { $sum: { $toDouble: '$amountKRW' } },
          cashCount: { $sum: { $cond: [{ $eq: ['$payment.type', 'CASH'] }, 1, 0] } },
          cashAmount: { $sum: { $cond: [{ $eq: ['$payment.type', 'CASH'] }, { $toDouble: '$amountKRW' }, 0] } },
          cardCount: { $sum: { $cond: [{ $eq: ['$payment.type', 'CARD'] }, 1, 0] } },
          cardAmount: { $sum: { $cond: [{ $eq: ['$payment.type', 'CARD'] }, { $toDouble: '$amountKRW' }, 0] } },
          refundCount: { $sum: { $cond: [{ $eq: ['$status', 'REFUNDED'] }, 1, 0] } },
          refundAmount: { $sum: { $cond: [{ $eq: ['$status', 'REFUNDED'] }, { $toDouble: '$amountKRW' }, 0] } },
        },
      },
    ];

    const [result] = await collection.aggregate(pipeline).toArray();

    const totalCount = result?.totalCount || 0;
    const totalAmount = result?.totalAmount || 0;

    return {
      totalCount,
      totalAmount: Math.round(totalAmount),
      avgAmount: totalCount > 0 ? Math.round(totalAmount / totalCount) : 0,
      byPaymentType: {
        cash: { count: result?.cashCount || 0, amount: Math.round(result?.cashAmount || 0) },
        card: { count: result?.cardCount || 0, amount: Math.round(result?.cardAmount || 0) },
      },
      refundCount: result?.refundCount || 0,
      refundAmount: Math.round(result?.refundAmount || 0),
    };
  }

  /**
   * 성능 통계 집계 (백분위수)
   */
  private async aggregatePerformance(kioskId: string, startOfDay: Date, endOfDay: Date) {
    const collection = this.db.collection('performance');
    const metricTypes = ['app_start', 'capture', 'render', 'print', 'payment'] as const;

    const result: Record<string, { p50: number; p95: number; p99: number }> = {};

    for (const metricType of metricTypes) {
      const durations = await collection
        .find({
          kioskId,
          metricType,
          timestamp: { $gte: startOfDay, $lte: endOfDay },
          success: true,
        })
        .project({ durationMs: 1 })
        .toArray();

      const values = durations.map(d => d.durationMs).sort((a, b) => a - b);

      result[metricType] = {
        p50: this.percentile(values, 50),
        p95: this.percentile(values, 95),
        p99: this.percentile(values, 99),
      };
    }

    return {
      appStart: result['app_start'],
      capture: result['capture'],
      render: result['render'],
      print: result['print'],
      payment: result['payment'],
    };
  }

  /**
   * 백분위수 계산
   */
  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  }

  /**
   * 에러 통계 집계
   */
  private async aggregateErrors(kioskId: string, startOfDay: Date, endOfDay: Date) {
    const collection = this.db.collection('errors');

    const pipeline = [
      {
        $match: {
          kioskId,
          timestamp: { $gte: startOfDay, $lte: endOfDay },
        },
      },
      {
        $facet: {
          total: [{ $count: 'count' }],
          bySeverity: [{ $group: { _id: '$severity', count: { $sum: 1 } } }],
          byCategory: [{ $group: { _id: '$category', count: { $sum: 1 } } }],
        },
      },
    ];

    const [result] = await collection.aggregate(pipeline).toArray();

    const severityMap: Record<string, number> = {};
    for (const item of result?.bySeverity || []) {
      severityMap[item._id] = item.count;
    }

    const categoryMap: Record<string, number> = {};
    for (const item of result?.byCategory || []) {
      categoryMap[item._id] = item.count;
    }

    return {
      total: result?.total[0]?.count || 0,
      bySeverity: {
        critical: severityMap['critical'] || 0,
        error: severityMap['error'] || 0,
        warning: severityMap['warning'] || 0,
      },
      byCategory: {
        hardware: categoryMap['hardware'] || 0,
        software: categoryMap['software'] || 0,
        network: categoryMap['network'] || 0,
        payment: categoryMap['payment'] || 0,
      },
    };
  }

  /**
   * 키오스크 메타데이터 조회
   */
  private async getKioskMetadata(kioskId: string): Promise<{
    storeId: string;
    groupId: string;
    countryCode: string;
  }> {
    const device = await this.db.collection('devices').findOne({ _id: kioskId as unknown as any });

    if (device) {
      return {
        storeId: device.store?.id || 'unknown',
        groupId: 'unknown',  // devices 컬렉션에 groupId가 없으면 stores에서 조회 필요
        countryCode: device.country?.code || 'unknown',
      };
    }

    // 세션에서 최근 데이터 조회
    const session = await this.db.collection('sessions')
      .findOne({ kioskId }, { sort: { startedAt: -1 } });

    return {
      storeId: session?.storeId || 'unknown',
      groupId: session?.groupId || 'unknown',
      countryCode: session?.countryCode || 'unknown',
    };
  }

  /**
   * 일일 요약 직렬화
   */
  serializeSummary(summary: DailySummaryDocument) {
    return {
      ...summary,
      _id: summary._id?.toHexString(),
      createdAt: summary.createdAt.toISOString(),
      updatedAt: summary.updatedAt.toISOString(),
    };
  }
}
