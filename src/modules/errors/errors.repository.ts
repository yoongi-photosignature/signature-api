import { Collection, Db, Filter, ObjectId } from 'mongodb';
import { ErrorDocument, ErrorSeverity, ErrorCategory } from '../../types/index.js';

export interface ErrorFilter {
  deviceId?: string;
  sessionId?: string;
  severity?: ErrorSeverity;
  category?: ErrorCategory;
  errorCode?: string;
  resolved?: boolean;
  startTime?: Date;
  endTime?: Date;
}

export class ErrorsRepository {
  private collection: Collection<ErrorDocument>;

  constructor(db: Db) {
    this.collection = db.collection('errors');
  }

  /**
   * 에러 생성
   */
  async create(error: Omit<ErrorDocument, '_id'>): Promise<ObjectId> {
    const result = await this.collection.insertOne(
      error as ErrorDocument,
      { writeConcern: { w: 'majority' } }
    );
    return result.insertedId;
  }

  /**
   * ID로 에러 조회
   */
  async findById(id: string): Promise<ErrorDocument | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }
    return this.collection.findOne({ _id: new ObjectId(id) });
  }

  /**
   * 에러 목록 조회
   */
  async findMany(filter: ErrorFilter, limit: number = 50, offset: number = 0): Promise<ErrorDocument[]> {
    const query = this.buildQuery(filter);

    return this.collection
      .find(query)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  /**
   * 에러 수 카운트
   */
  async count(filter: ErrorFilter): Promise<number> {
    const query = this.buildQuery(filter);
    return this.collection.countDocuments(query);
  }

  /**
   * 에러 해결 표시
   */
  async resolve(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) {
      return false;
    }
    const result = await this.collection.updateOne(
      { _id: new ObjectId(id), resolved: false },
      { $set: { resolved: true, resolvedAt: new Date() } },
      { writeConcern: { w: 'majority' } }
    );
    return result.modifiedCount === 1;
  }

  /**
   * 특정 기간의 에러 통계 (집계용)
   */
  async getErrorStats(deviceId: string, startDate: Date, endDate: Date): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const pipeline = [
      {
        $match: {
          deviceId,
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $facet: {
          total: [{ $count: 'count' }],
          bySeverity: [
            { $group: { _id: '$severity', count: { $sum: 1 } } },
          ],
          byCategory: [
            { $group: { _id: '$category', count: { $sum: 1 } } },
          ],
        },
      },
    ];

    const [result] = await this.collection.aggregate(pipeline).toArray();

    const bySeverity: Record<string, number> = {};
    for (const item of result.bySeverity) {
      bySeverity[item._id] = item.count;
    }

    const byCategory: Record<string, number> = {};
    for (const item of result.byCategory) {
      byCategory[item._id] = item.count;
    }

    return {
      total: result.total[0]?.count || 0,
      bySeverity,
      byCategory,
    };
  }

  /**
   * 쿼리 빌더
   */
  private buildQuery(filter: ErrorFilter): Filter<ErrorDocument> {
    const query: Filter<ErrorDocument> = {};

    if (filter.deviceId) query.deviceId = filter.deviceId;
    if (filter.sessionId) query.sessionId = filter.sessionId;
    if (filter.severity) query.severity = filter.severity;
    if (filter.category) query.category = filter.category;
    if (filter.errorCode) query.errorCode = filter.errorCode;
    if (filter.resolved !== undefined) query.resolved = filter.resolved;

    if (filter.startTime || filter.endTime) {
      query.timestamp = {};
      if (filter.startTime) query.timestamp.$gte = filter.startTime;
      if (filter.endTime) query.timestamp.$lte = filter.endTime;
    }

    return query;
  }
}
