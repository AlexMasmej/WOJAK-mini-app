import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Allowed hostnames for direct image URLs
const ALLOWED_IMAGE_HOSTS = ['pbs.twimg.com', 'abs.twimg.com'];

// Browser-like user agent for fetching tweets
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface ExtractImageRequest {
  url: string;
  mode: 'tweet' | 'image';
}

interface ExtractImageResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

/**
 * Normalize Twitter image URL to original quality
 * Replaces or appends name=orig parameter
 */
function normalizeToOriginalQuality(url: string): string {
  try {
    const parsed = new URL(url);

    // Only normalize pbs.twimg.com URLs
    if (parsed.hostname === 'pbs.twimg.com') {
      parsed.searchParams.set('name', 'orig');
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Validate that a URL is from an allowed image host
 */
function isAllowedImageHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_IMAGE_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Check if a URL looks like a Twitter/X tweet URL
 */
function isTweetUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const isTwitterHost =
      parsed.hostname === 'twitter.com' ||
      parsed.hostname === 'www.twitter.com' ||
      parsed.hostname === 'x.com' ||
      parsed.hostname === 'www.x.com' ||
      parsed.hostname === 'mobile.twitter.com' ||
      parsed.hostname === 'mobile.x.com';

    // Check for status pattern: /{username}/status/{id}
    const statusPattern = /^\/[^/]+\/status\/\d+/;
    return isTwitterHost && statusPattern.test(parsed.pathname);
  } catch {
    return false;
  }
}

/**
 * Extract image URL from tweet HTML using Open Graph meta tags
 */
function extractImageFromHtml(html: string): string | null {
  // Try og:image first (most reliable)
  const ogImageMatch = html.match(
    /<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i
  );
  if (ogImageMatch?.[1]) {
    return ogImageMatch[1];
  }

  // Also try content before property (different attribute order)
  const ogImageAltMatch = html.match(
    /<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i
  );
  if (ogImageAltMatch?.[1]) {
    return ogImageAltMatch[1];
  }

  // Try twitter:image as fallback
  const twitterImageMatch = html.match(
    /<meta\s+(?:property|name)=["']twitter:image["']\s+content=["']([^"']+)["']/i
  );
  if (twitterImageMatch?.[1]) {
    return twitterImageMatch[1];
  }

  // Alt order for twitter:image
  const twitterImageAltMatch = html.match(
    /<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']twitter:image["']/i
  );
  if (twitterImageAltMatch?.[1]) {
    return twitterImageAltMatch[1];
  }

  return null;
}

/**
 * Fetch tweet HTML and extract image URL
 */
async function extractImageFromTweet(tweetUrl: string): Promise<string> {
  // Validate tweet URL format
  if (!isTweetUrl(tweetUrl)) {
    throw new Error(
      'Invalid tweet URL. Please provide a link like x.com/username/status/123...'
    );
  }

  // Fetch the tweet page
  const response = await fetch(tweetUrl, {
    headers: {
      'User-Agent': BROWSER_UA,
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Cache-Control': 'no-cache',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Tweet not found. It may have been deleted or made private.');
    }
    throw new Error(`Failed to fetch tweet (HTTP ${response.status})`);
  }

  const html = await response.text();

  // Extract image from meta tags
  const imageUrl = extractImageFromHtml(html);

  if (!imageUrl) {
    throw new Error(
      'No image found in this tweet. The tweet may not contain an image, or Twitter blocked the request.'
    );
  }

  // Validate the extracted URL is from Twitter's image CDN
  if (!isAllowedImageHost(imageUrl)) {
    // Still return it but log a warning - og:image might be a video thumbnail etc.
    console.warn(
      `Extracted image URL from unexpected host: ${imageUrl}`
    );
  }

  return normalizeToOriginalQuality(imageUrl);
}

export async function POST(request: NextRequest): Promise<NextResponse<ExtractImageResponse>> {
  try {
    // Parse request body
    let body: ExtractImageRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { url, mode } = body;

    // Validate required fields
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    if (mode !== 'tweet' && mode !== 'image') {
      return NextResponse.json(
        { success: false, error: 'Mode must be "tweet" or "image"' },
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Only allow http/https
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json(
        { success: false, error: 'URL must use HTTP or HTTPS protocol' },
        { status: 400 }
      );
    }

    if (mode === 'image') {
      // Direct image URL mode - validate hostname
      if (!isAllowedImageHost(url)) {
        return NextResponse.json(
          {
            success: false,
            error: `Image URL must be from ${ALLOWED_IMAGE_HOSTS.join(' or ')}`,
          },
          { status: 400 }
        );
      }

      // Return normalized URL
      return NextResponse.json({
        success: true,
        imageUrl: normalizeToOriginalQuality(url),
      });
    }

    // Tweet URL mode - extract image
    try {
      const imageUrl = await extractImageFromTweet(url);

      return NextResponse.json({
        success: true,
        imageUrl,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to extract image from tweet';

      return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Extract image API error:', error);

    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
