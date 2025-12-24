import { PerformanceRepository, PerformanceFilter } from './performance.repository.js';
import { CreatePerformanceInput, BatchPerformanceInput, PerformanceDocument } from '../../types/index.js';

export class PerformanceService {
  constructor(private repository: PerformanceRepository) {}

  /**
   * 단일 성능 지표 기록
   */
  async createMetric(kioskId: string, input: CreatePerformanceInput): Promise<string> {
    const metric: Omit<PerformanceDocument, '_id'> = {
      timestamp: new Date(input.timestamp),
      kioskId,
      sessionId: input.sessionId,
      metricType: input.metricType,
      durationMs: input.durationMs,
      breakdown: input.breakdown,
      context: input.context,
      success: input.success,
      errorMessage: input.errorMessage,
      createdAt: new Date(),
    };

    return this.repository.create(metric);
  }

  /**
   * 배치 성능 지표 기록
   */
  async insertBatch(input: BatchPerformanceInput): Promise<{ inserted: number; errors: number }> {
    const { kioskId, metrics } = input;

    if (metrics.length === 0) {
      return { inserted: 0, errors: 0 };
    }

    const documents: Omit<PerformanceDocument, '_id'>[] = metrics.map(m => ({
      timestamp: new Date(m.timestamp),
      kioskId,
      sessionId: m.sessionId,
      metricType: m.metricType,
      durationMs: m.durationMs,
      breakdown: m.breakdown,
      context: m.context,
      success: m.success,
      errorMessage: m.errorMessage,
      createdAt: new Date(),
    }));

    try {
      const result = await this.repository.insertBatch(documents);
      return { inserted: result.insertedCount, errors: 0 };
    } catch (error) {
      // BulkWriteError의 경우 부분 성공 가능
      const bulkError = error as { insertedCount?: number };
      return {
        inserted: bulkError.insertedCount || 0,
        errors: documents.length - (bulkError.insertedCount || 0),
      };
    }
  }

  /**
   * 성능 지표 목록 조회
   */
  async listMetrics(
    filter: PerformanceFilter,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ metrics: PerformanceDocument[]; total: number }> {
    const [metrics, total] = await Promise.all([
      this.repository.findMany(filter, limit, offset),
      this.repository.count(filter),
    ]);

    return { metrics, total };
  }

  /**
   * 성능 지표 직렬화
   */
  serializeMetric(metric: PerformanceDocument) {
    return {
      ...metric,
      _id: metric._id?.toHexString(),
      timestamp: metric.timestamp.toISOString(),
      createdAt: metric.createdAt.toISOString(),
    };
  }
}
