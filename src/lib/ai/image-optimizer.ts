/**
 * Optimize image URLs for OpenAI Vision API cost savings.
 * - Facebook CDN: rewrite to smaller size (saves bandwidth)
 * - Instagram CDN: same
 * - Data URLs: pass through (local tests)
 */

export function optimizeImageUrl(url: string): string {
  if (url.startsWith('data:')) return url

  try {
    const u = new URL(url)
    // Facebook/Instagram CDN: add size params
    if (u.hostname.includes('fbcdn.net') || u.hostname.includes('cdninstagram.com')) {
      // FB images often have _n.jpg (normal) — can request _s.jpg (small) or use size params
      // Most reliable: just let OpenAI resize (detail: low already = 85 tokens regardless of source)
      return url
    }

    // Generic CDN with width param support (unsplash, cloudinary, etc.)
    if (u.hostname.includes('unsplash.com')) {
      u.searchParams.set('w', '512')
      u.searchParams.set('q', '70')
      return u.toString()
    }
  } catch {
    // Invalid URL — return as-is
  }

  return url
}

/**
 * Estimate tokens used for a vision call based on detail level.
 * detail: 'low' = 85 tokens regardless of size
 * detail: 'high' = 85 + 170 * tiles (calculated from resolution)
 */
export function estimateVisionTokens(detail: 'low' | 'high' = 'low'): number {
  return detail === 'low' ? 85 : 765 // high ≈ 85 + 170 * 4 for typical product image
}
