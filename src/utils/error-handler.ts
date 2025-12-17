import { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';

// 마스킹 대상 민감 정보 패턴
const SENSITIVE_PATTERNS = [
  // MongoDB connection strings
  /mongodb(\+srv)?:\/\/[^@]+@[^\s]+/gi,
  // API keys (common patterns)
  /api[_-]?key[=:]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/gi,
  // Bearer tokens
  /bearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi,
  // Generic secrets
  /secret[=:]\s*['"]?[a-zA-Z0-9_-]{10,}['"]?/gi,
  // Password patterns
  /password[=:]\s*['"]?[^\s'"]+['"]?/gi,
  // Firebase credentials
  /firebase[a-zA-Z]*[=:]\s*['"]?[^\s'"]+['"]?/gi,
  // GCP credentials
  /private_key[=:]\s*['"]?-----BEGIN[^'"]+-----END[^'"]+['"]?/gi,
  // Email addresses (partial mask)
  /([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/gi,
];

/**
 * 에러 메시지에서 민감 정보를 마스킹
 */
export function maskSensitiveInfo(message: string): string {
  let masked = message;

  // MongoDB URI 마스킹
  masked = masked.replace(/mongodb(\+srv)?:\/\/[^@]+@[^\s]+/gi, 'mongodb://***:***@[MASKED]');

  // API key 마스킹
  masked = masked.replace(/api[_-]?key[=:]\s*['"]?[a-zA-Z0-9_-]{20,}['"]?/gi, 'api_key=[MASKED]');

  // Bearer token 마스킹
  masked = masked.replace(/bearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi, 'Bearer [MASKED]');

  // Secret 마스킹
  masked = masked.replace(/secret[=:]\s*['"]?[a-zA-Z0-9_-]{10,}['"]?/gi, 'secret=[MASKED]');

  // Password 마스킹
  masked = masked.replace(/password[=:]\s*['"]?[^\s'"]+['"]?/gi, 'password=[MASKED]');

  // 이메일 부분 마스킹
  masked = masked.replace(/([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/gi, '***@$2');

  return masked;
}

/**
 * 프로덕션 환경에서 안전한 에러 응답 생성
 */
export function createSafeErrorResponse(
  error: Error | FastifyError,
  isProduction: boolean = process.env.NODE_ENV === 'production'
): {
  statusCode: number;
  error: string;
  message: string;
} {
  const statusCode = (error as FastifyError).statusCode || 500;
  const errorName = statusCode >= 500 ? 'Internal Server Error' : (error as FastifyError).code || error.name;

  if (isProduction && statusCode >= 500) {
    // 프로덕션에서 500 에러는 상세 정보 숨김
    return {
      statusCode,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
    };
  }

  return {
    statusCode,
    error: errorName,
    message: maskSensitiveInfo(error.message),
  };
}

/**
 * Fastify 에러 핸들러 설정
 */
export function setupErrorHandler(app: FastifyInstance): void {
  const isProduction = process.env.NODE_ENV === 'production';

  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // 에러 로깅 (내부용 - 전체 정보)
    app.log.error({
      err: error,
      requestId: request.id,
      method: request.method,
      url: request.url,
    });

    const safeError = createSafeErrorResponse(error, isProduction);

    reply.status(safeError.statusCode).send(safeError);
  });
}

/**
 * 요청 ID 기반 에러 추적을 위한 유틸리티
 */
export function logErrorWithContext(
  logger: FastifyInstance['log'],
  error: Error,
  context: Record<string, unknown>
): void {
  logger.error({
    err: {
      name: error.name,
      message: maskSensitiveInfo(error.message),
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    },
    ...context,
  });
}
