import { Decimal128 } from 'mongodb';

/**
 * Convert string or number to Decimal128
 */
export function toDecimal128(value: string | number): Decimal128 {
  return Decimal128.fromString(String(value));
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
 */
export function toNumber(decimal: Decimal128 | undefined): number {
  if (!decimal) return 0;
  return parseFloat(decimal.toString());
}
