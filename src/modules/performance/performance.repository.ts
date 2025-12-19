import { Collection, Db, Filter, InsertManyResult } from 'mongodb';
import { PerformanceDocument, MetricType } from '../../types/index.js';

export interface PerformanceFilter {
  deviceId?: string;
  sessionId?: string;
  metricType?: MetricType;
  startTime?: Date;
  endTime?: Date;
}

export class PerformanceRepository {
  private collection: Collection<PerformanceDocument>;

  constructor(db: Db) {
    this.collection = db.collection('performance');
  }

  /**
   * 단일 성능 지표 삽입
   */
  async create(metric: Omit<PerformanceDocument, '_id'>): Promise<string> {
    const result = await this.collection.insertOne(
      metric as PerformanceDocument,
      { writeConcern: { w: 'majority' } }
    );
    return result.insertedId.toHexString();
  }

  /**
   * 배치 삽입
   */
  async insertBatch(metrics: Omit<PerformanceDocument, '_id'>[]): Promise<InsertManyResult<PerformanceDocument>> {
    return this.collection.insertMany(metrics as PerformanceDocument[], {
      ordered: false,
      writeConcern: { w: 'majority' },
    });
  }

  /**
   * 필터 조건으로 조회
   */
  async findMany(filter: PerformanceFilter, limit: number = 100, offset: number = 0): Promise<PerformanceDocument[]> {
    const query = this.buildQuery(filter);

    return this.collection
      .find(query)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  /**
   * 카운트
   */
  async count(filter: PerformanceFilter): Promise<number> {
    const query = this.buildQuery(filter);
    return this.collection.countDocuments(query);
  }

  /**
   * 특정 기간의 백분위수 계산용 데이터 조회
   */
  async getMetricsForPercentile(
    deviceId: string,
    metricType: MetricType,
    startDate: Date,
    endDate: Date
  ): Promise<number[]> {
    const results = await this.collection
      .find({
        deviceId,
        metricType,
        timestamp: { $gte: startDate, $lte: endDate },
        success: true,
      })
      .project({ durationMs: 1 })
      .toArray();

    return results.map(r => r.durationMs);
  }

  /**
   * 쿼리 빌더
   */
  private buildQuery(filter: PerformanceFilter): Filter<PerformanceDocument> {
    const query: Filter<PerformanceDocument> = {};

    if (filter.deviceId) query.deviceId = filter.deviceId;
    if (filter.sessionId) query.sessionId = filter.sessionId;
    if (filter.metricType) query.metricType = filter.metricType;

    if (filter.startTime || filter.endTime) {
      query.timestamp = {};
      if (filter.startTime) query.timestamp.$gte = filter.startTime;
      if (filter.endTime) query.timestamp.$lte = filter.endTime;
    }

    return query;
  }
}
