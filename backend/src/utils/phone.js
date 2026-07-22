/**
 * Normalize Saudi / local phones to E.164 (+966…).
 * Accepts: +9665XXXXXXXX, 9665XXXXXXXX, 05XXXXXXXX, 5XXXXXXXX
 */
export function normalizePhone(input) {
  if (input == null || typeof input !== 'string') {
    throw new Error('Phone is required');
  }

  let digits = input.trim().replace(/[\s()-]/g, '');

  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  }

  if (!/^\d+$/.test(digits)) {
    throw new Error('Phone must contain only digits');
  }

  // 05XXXXXXXX → 9665XXXXXXXX
  if (digits.startsWith('05') && digits.length === 10) {
    digits = `966${digits.slice(1)}`;
  }

  // 5XXXXXXXX → 9665XXXXXXXX
  if (digits.startsWith('5') && digits.length === 9) {
    digits = `966${digits}`;
  }

  if (!digits.startsWith('966') || digits.length !== 12) {
    throw new Error('Phone must be a valid Saudi mobile in E.164 (+9665XXXXXXXX)');
  }

  if (!digits.startsWith('9665')) {
    throw new Error('Phone must be a Saudi mobile number (+9665…)');
  }

  return `+${digits}`;
}

export function tryNormalizePhone(input) {
  try {
    return normalizePhone(input);
  } catch {
    return null;
  }
}
