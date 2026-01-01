
export const TIMEZONE = 'Australia/Melbourne';

/**
 * Get current date object in Melbourne timezone
 */
export const getMelbourneDate = (): Date => {
  const now = new Date();
  const melString = now.toLocaleString('en-US', { timeZone: TIMEZONE });
  return new Date(melString);
};

/**
 * Get ID Prefix in YYMMDD format (Melbourne Time)
 * e.g., 231027
 */
export const getMelbourneIdPrefix = (): string => {
  const d = getMelbourneDate();
  const year = d.getFullYear().toString().slice(2);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

/**
 * Get full time string in YYYYMMDDHHmm format (Melbourne Time)
 * Used for Order Header TIME field
 */
export const getMelbourneTimeString = (): string => {
  const d = getMelbourneDate();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}`;
};

/**
 * Get ISO Date string YYYY-MM-DD (Melbourne Time)
 * Used for Date Pickers
 */
export const getMelbourneISODate = (): string => {
  const d = getMelbourneDate();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Calculate Start Date for filters (Melbourne Time)
 */
export const getMelbourneFilterDate = (daysAgo: number): string => {
  const d = getMelbourneDate();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
