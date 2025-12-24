import { ErrorsRepository, ErrorFilter } from './errors.repository.js';
import { CreateErrorInput, ErrorDocument } from '../../types/index.js';

export class ErrorsService {
  constructor(private repository: ErrorsRepository) {}

  /**
   * 에러 리포트 생성
   */
  async createError(kioskId: string, input: CreateErrorInput): Promise<string> {
    const error: Omit<ErrorDocument, '_id'> = {
      timestamp: new Date(input.timestamp),
      kioskId,
      sessionId: input.sessionId,
      severity: input.severity,
      category: input.category,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      stackTrace: input.stackTrace,
      deviceState: input.deviceState,
      recentEvents: input.recentEvents,
      appVersion: input.appVersion,
      resolved: false,
      createdAt: new Date(),
    };

    const id = await this.repository.create(error);
    return id.toHexString();
  }

  /**
   * 에러 상세 조회
   */
  async getError(id: string): Promise<ErrorDocument | null> {
    return this.repository.findById(id);
  }

  /**
   * 에러 목록 조회
   */
  async listErrors(
    filter: ErrorFilter,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ errors: ErrorDocument[]; total: number }> {
    const [errors, total] = await Promise.all([
      this.repository.findMany(filter, limit, offset),
      this.repository.count(filter),
    ]);

    return { errors, total };
  }

  /**
   * 에러 해결 표시
   */
  async resolveError(id: string): Promise<boolean> {
    return this.repository.resolve(id);
  }

  /**
   * 에러 직렬화
   */
  serializeError(error: ErrorDocument) {
    return {
      ...error,
      _id: error._id?.toHexString(),
      timestamp: error.timestamp.toISOString(),
      resolvedAt: error.resolvedAt?.toISOString(),
      createdAt: error.createdAt.toISOString(),
    };
  }
}
