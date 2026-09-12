/**
 * Utility functions for radio station URL normalization, canonicalization, and strict isolation comparison.
 */

export function normalizeStationUrl(url?: string | null): string {
  if (!url) return '';
  let cleaned = url.trim();
  // Extract destination URL if wrapped inside local or remote proxy
  if (cleaned.includes('/api/radio-stream-proxy') || cleaned.includes('/api/radio-stream-delayed')) {
    try {
      const parsed = new URL(cleaned, 'http://localhost:3000');
      const targetParam = parsed.searchParams.get('url');
      if (targetParam && (targetParam.startsWith('http://') || targetParam.startsWith('https://'))) {
        cleaned = targetParam;
      }
    } catch (_) {}
  }
  // Strip trailing slash and lowercase for protocol/host comparison
  return cleaned.replace(/\/+$/, '').toLowerCase();
}

/**
 * Checks if two station URLs represent the exact same canonical radio station.
 */
export function isStationUrlMatch(urlA?: string | null, urlB?: string | null): boolean {
  if (!urlA || !urlB) return false;
  const normA = normalizeStationUrl(urlA);
  const normB = normalizeStationUrl(urlB);
  if (!normA || !normB) return false;
  return normA === normB;
}
