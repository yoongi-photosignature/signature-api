import { Collection, Db, Filter } from 'mongodb';
import { DailySummaryDocument } from '../../types/index.js';

export interface DailySummaryFilter {
  kioskId?: string;
  storeId?: string;
  groupId?: string;
  startDate?: string;
  endDate?: string;
}

export class DailySummaryRepository {
  private collection: Collection<DailySummaryDocument>;

  constructor(db: Db) {
    this.collection = db.collection('dailySummary');
  }

  /**
   * 일일 요약 생성 또는 업데이트 (upsert)
   */
  async upsert(summary: Omit<DailySummaryDocument, '_id'>): Promise<void> {
    await this.collection.updateOne(
      { date: summary.date, kioskId: summary.kioskId },
      { $set: summary },
      { upsert: true, writeConcern: { w: 'majority' } }
    );
  }

  /**
   * 특정 날짜/키오스크 조회
   */
  async findOne(date: string, kioskId: string): Promise<DailySummaryDocument | null> {
    return this.collection.findOne({ date, kioskId });
  }

  /**
   * 필터 조건으로 조회
   */
  async findMany(filter: DailySummaryFilter, limit: number = 30, offset: number = 0): Promise<DailySummaryDocument[]> {
    const query = this.buildQuery(filter);

    return this.collection
      .find(query)
      .sort({ date: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  /**
   * 카운트
   */
  async count(filter: DailySummaryFilter): Promise<number> {
    const query = this.buildQuery(filter);
    return this.collection.countDocuments(query);
  }

  /**
   * 그룹별 집계 (여러 디바이스 합산)
   */
  async getGroupSummary(groupId: string, startDate: string, endDate: string): Promise<DailySummaryDocument[]> {
    return this.collection
      .find({
        groupId,
        date: { $gte: startDate, $lte: endDate },
      })
      .sort({ date: -1 })
      .toArray();
  }

  /**
   * 쿼리 빌더
   */
  private buildQuery(filter: DailySummaryFilter): Filter<DailySummaryDocument> {
    const query: Filter<DailySummaryDocument> = {};

    if (filter.kioskId) query.kioskId = filter.kioskId;
    if (filter.storeId) query.storeId = filter.storeId;
    if (filter.groupId) query.groupId = filter.groupId;

    if (filter.startDate || filter.endDate) {
      query.date = {};
      if (filter.startDate) query.date.$gte = filter.startDate;
      if (filter.endDate) query.date.$lte = filter.endDate;
    }

    return query;
  }
}
