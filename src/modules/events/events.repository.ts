import { Collection, Db, Filter, InsertManyResult } from 'mongodb';
import { EventDocument, EventType } from '../../types/index.js';

export interface EventFilter {
  sessionId?: string;
  deviceId?: string;
  eventType?: EventType;
  startTime?: Date;
  endTime?: Date;
}

export class EventsRepository {
  private collection: Collection<EventDocument>;

  constructor(db: Db) {
    this.collection = db.collection('events');
  }

  /**
   * 이벤트 배치 삽입 (중복 무시, 순서 무관)
   */
  async insertBatch(events: Omit<EventDocument, '_id'>[]): Promise<InsertManyResult<EventDocument>> {
    // ordered: false로 설정하여 하나의 실패가 나머지에 영향 주지 않음
    return this.collection.insertMany(events as EventDocument[], {
      ordered: false,
      writeConcern: { w: 'majority' },
    });
  }

  /**
   * 세션별 이벤트 조회
   */
  async findBySession(sessionId: string, limit: number = 100): Promise<EventDocument[]> {
    return this.collection
      .find({ sessionId })
      .sort({ sequenceNo: 1 })
      .limit(limit)
      .toArray();
  }

  /**
   * 필터 조건으로 이벤트 조회
   */
  async findMany(filter: EventFilter, limit: number = 100, offset: number = 0): Promise<EventDocument[]> {
    const query = this.buildQuery(filter);

    return this.collection
      .find(query)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  /**
   * 중복 체크 (sessionId + sequenceNo)
   */
  async checkDuplicates(sessionId: string, sequenceNos: number[]): Promise<number[]> {
    const existing = await this.collection
      .find(
        { sessionId, sequenceNo: { $in: sequenceNos } },
        { projection: { sequenceNo: 1 } }
      )
      .toArray();

    return existing.map(e => e.sequenceNo);
  }

  /**
   * 쿼리 빌더
   */
  private buildQuery(filter: EventFilter): Filter<EventDocument> {
    const query: Filter<EventDocument> = {};

    if (filter.sessionId) query.sessionId = filter.sessionId;
    if (filter.deviceId) query.deviceId = filter.deviceId;
    if (filter.eventType) query.eventType = filter.eventType;

    if (filter.startTime || filter.endTime) {
      query.timestamp = {};
      if (filter.startTime) query.timestamp.$gte = filter.startTime;
      if (filter.endTime) query.timestamp.$lte = filter.endTime;
    }

    return query;
  }

  /**
   * 이벤트 수 카운트
   */
  async count(filter: EventFilter): Promise<number> {
    const query = this.buildQuery(filter);
    return this.collection.countDocuments(query);
  }
}
