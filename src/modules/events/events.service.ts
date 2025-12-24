import { EventsRepository, EventFilter } from './events.repository.js';
import { BatchEventsInput, EventDocument, CreateEventInput } from '../../types/index.js';

export interface BatchInsertResult {
  inserted: number;
  duplicates: number;
  errors: number;
}

export class EventsService {
  constructor(private repository: EventsRepository) {}

  /**
   * 이벤트 배치 삽입
   */
  async insertBatch(input: BatchEventsInput): Promise<BatchInsertResult> {
    const { kioskId, events } = input;

    if (events.length === 0) {
      return { inserted: 0, duplicates: 0, errors: 0 };
    }

    // 세션별로 그룹화하여 중복 체크
    const sessionGroups = new Map<string, CreateEventInput[]>();
    for (const event of events) {
      const group = sessionGroups.get(event.sessionId) || [];
      group.push(event);
      sessionGroups.set(event.sessionId, group);
    }

    // 중복 sequenceNo 필터링
    const eventsToInsert: Omit<EventDocument, '_id'>[] = [];
    let duplicateCount = 0;

    for (const [sessionId, sessionEvents] of sessionGroups) {
      const sequenceNos = sessionEvents.map(e => e.sequenceNo);
      const existingNos = await this.repository.checkDuplicates(sessionId, sequenceNos);
      const existingSet = new Set(existingNos);

      for (const event of sessionEvents) {
        if (existingSet.has(event.sequenceNo)) {
          duplicateCount++;
          continue;
        }

        eventsToInsert.push({
          timestamp: new Date(event.timestamp),
          kioskId,
          sessionId: event.sessionId,
          sequenceNo: event.sequenceNo,
          eventType: event.eventType,
          screenName: event.screenName,
          targetId: event.targetId,
          targetType: event.targetType,
          position: event.position,
          value: event.value,
          metadata: event.metadata,
          createdAt: new Date(),
        });
      }
    }

    if (eventsToInsert.length === 0) {
      return { inserted: 0, duplicates: duplicateCount, errors: 0 };
    }

    try {
      const result = await this.repository.insertBatch(eventsToInsert);
      return {
        inserted: result.insertedCount,
        duplicates: duplicateCount,
        errors: eventsToInsert.length - result.insertedCount,
      };
    } catch (error) {
      // BulkWriteError의 경우 부분 성공 가능
      const bulkError = error as { insertedCount?: number };
      return {
        inserted: bulkError.insertedCount || 0,
        duplicates: duplicateCount,
        errors: eventsToInsert.length - (bulkError.insertedCount || 0),
      };
    }
  }

  /**
   * 세션별 이벤트 조회
   */
  async getEventsBySession(sessionId: string): Promise<EventDocument[]> {
    return this.repository.findBySession(sessionId);
  }

  /**
   * 이벤트 목록 조회
   */
  async listEvents(
    filter: EventFilter,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ events: EventDocument[]; total: number }> {
    const [events, total] = await Promise.all([
      this.repository.findMany(filter, limit, offset),
      this.repository.count(filter),
    ]);

    return { events, total };
  }

  /**
   * 이벤트 직렬화
   */
  serializeEvent(event: EventDocument) {
    return {
      ...event,
      _id: event._id?.toHexString(),
      timestamp: event.timestamp.toISOString(),
      createdAt: event.createdAt.toISOString(),
    };
  }
}
