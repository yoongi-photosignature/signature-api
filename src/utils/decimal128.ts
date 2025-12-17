import { Decimal128 } from 'mongodb';
import { safeParseFloat } from './safe-parse.js';

/**
 * Convert string or number to Decimal128
 * NaN이나 유효하지 않은 값은 0으로 처리
 */
export function toDecimal128(value: string | number): Decimal128 {
  const numValue = typeof value === 'string' ? safeParseFloat(value, 0) : value;
  const safeValue = Number.isNaN(numValue) || !Number.isFinite(numValue) ? 0 : numValue;
  return Decimal128.fromString(String(safeValue));
}

/**
 * Convert Decimal128 to string
 */
export function fromDecimal128(decimal: Decimal128 | undefined): string {
  if (!decimal) return '0';
  return decimal.toString();
}

/**
 * Convert Decimal128 to number (use for display only, not calculations)
 * NaN 방지 처리 포함
 */
export function toNumber(decimal: Decimal128 | undefined): number {
  if (!decimal) return 0;
  return safeParseFloat(decimal.toString(), 0);
}
