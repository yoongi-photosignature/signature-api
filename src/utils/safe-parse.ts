/**
 * 안전한 parseFloat - NaN 방지 및 기본값 제공
 */
export function safeParseFloat(value: string | number | undefined | null, defaultValue: number = 0): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? defaultValue : value;
  }

  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 안전한 parseInt - NaN 방지 및 기본값 제공
 */
export function safeParseInt(value: string | number | undefined | null, defaultValue: number = 0, radix: number = 10): number {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? defaultValue : Math.floor(value);
  }

  const parsed = parseInt(value, radix);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 양수 검증이 포함된 안전한 parseFloat
 */
export function safeParsePositiveFloat(value: string | number | undefined | null, defaultValue: number = 0): number {
  const parsed = safeParseFloat(value, defaultValue);
  return parsed >= 0 ? parsed : defaultValue;
}

/**
 * 범위 검증이 포함된 안전한 parseFloat
 */
export function safeParseFloatInRange(
  value: string | number | undefined | null,
  min: number,
  max: number,
  defaultValue: number = min
): number {
  const parsed = safeParseFloat(value, defaultValue);
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

/**
 * 비율(0-1) 파싱용 유틸리티
 */
export function safeParseRate(value: string | number | undefined | null, defaultValue: number = 0): number {
  return safeParseFloatInRange(value, 0, 1, defaultValue);
}

/**
 * 가격/금액 파싱용 유틸리티 (음수 불가)
 */
export function safeParseAmount(value: string | number | undefined | null, defaultValue: number = 0): number {
  return safeParsePositiveFloat(value, defaultValue);
}

/**
 * 날짜 문자열의 안전한 파싱
 */
export function safeParseDateString(value: string | undefined | null): Date | null {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * ObjectId 형식 검증
 */
export function isValidObjectIdFormat(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value);
}

/**
 * 안전한 ID 형식 검증 (NoSQL Injection 방지)
 */
export function isValidSafeId(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value) && value.length <= 100;
}
