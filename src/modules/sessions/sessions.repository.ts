import { Collection, Db, Filter } from 'mongodb';
import { SessionDocument, SessionStatus } from '../../types/index.js';

export interface SessionFilter {
  deviceId?: string;
  storeId?: string;
  groupId?: string;
  status?: SessionStatus;
  startDate?: Date;
  endDate?: Date;
}

export class SessionsRepository {
  private collection: Collection<SessionDocument>;

  constructor(db: Db) {
    this.collection = db.collection('sessions');
  }

  /**
   * 세션 생성
   */
  async create(session: Omit<SessionDocument, '_id'>): Promise<string> {
    await this.collection.insertOne(
      session as SessionDocument,
      { writeConcern: { w: 'majority' } }
    );
    return session.sessionId;
  }

  /**
   * sessionId로 세션 조회
   */
  async findBySessionId(sessionId: string): Promise<SessionDocument | null> {
    return this.collection.findOne({ sessionId });
  }

  /**
   * 세션 업데이트 (부분 업데이트)
   */
  async update(sessionId: string, data: Partial<SessionDocument>): Promise<boolean> {
    const result = await this.collection.updateOne(
      { sessionId },
      { $set: { ...data, updatedAt: new Date() } },
      { writeConcern: { w: 'majority' } }
    );
    return result.modifiedCount === 1;
  }

  /**
   * 필터 조건으로 세션 목록 조회
   */
  async findMany(filter: SessionFilter, limit: number = 20, offset: number = 0): Promise<SessionDocument[]> {
    const query: Filter<SessionDocument> = {};

    if (filter.deviceId) query.deviceId = filter.deviceId;
    if (filter.storeId) query.storeId = filter.storeId;
    if (filter.groupId) query.groupId = filter.groupId;
    if (filter.status) query.status = filter.status;

    if (filter.startDate || filter.endDate) {
      query.startedAt = {};
      if (filter.startDate) query.startedAt.$gte = filter.startDate;
      if (filter.endDate) query.startedAt.$lte = filter.endDate;
    }

    return this.collection
      .find(query)
      .sort({ startedAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  /**
   * 필터 조건으로 세션 수 카운트
   */
  async count(filter: SessionFilter): Promise<number> {
    const query: Filter<SessionDocument> = {};

    if (filter.deviceId) query.deviceId = filter.deviceId;
    if (filter.storeId) query.storeId = filter.storeId;
    if (filter.groupId) query.groupId = filter.groupId;
    if (filter.status) query.status = filter.status;

    if (filter.startDate || filter.endDate) {
      query.startedAt = {};
      if (filter.startDate) query.startedAt.$gte = filter.startDate;
      if (filter.endDate) query.startedAt.$lte = filter.endDate;
    }

    return this.collection.countDocuments(query);
  }

  /**
   * 디바이스별 최근 세션 조회
   */
  async findLatestByDevice(deviceId: string): Promise<SessionDocument | null> {
    return this.collection
      .find({ deviceId })
      .sort({ startedAt: -1 })
      .limit(1)
      .next();
  }

  /**
   * 세션 삭제 (테스트용)
   */
  async delete(sessionId: string): Promise<boolean> {
    const result = await this.collection.deleteOne(
      { sessionId },
      { writeConcern: { w: 'majority' } }
    );
    return result.deletedCount === 1;
  }
}
