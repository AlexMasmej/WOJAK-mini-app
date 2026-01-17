import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Allowed hostnames for direct image URLs
const ALLOWED_IMAGE_HOSTS = ['pbs.twimg.com', 'abs.twimg.com'];

// User agent for API requests
const API_UA = 'WOJAK-mini-app/1.0';

// vxTwitter API response type
interface VxTwitterResponse {
  mediaURLs?: string[];
  media_extended?: Array<{
    type: string;
    url: string;
    thumbnail_url?: string;
  }>;
}

// fxTwitter API response type
interface FxTwitterResponse {
  tweet?: {
    media?: {
      photos?: Array<{
        url: string;
      }>;
    };
  };
}

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
 * Convert tweet URL to API URL format
 * Extracts username and tweet ID from the URL
 */
function getTweetApiUrls(tweetUrl: string): { vxTwitter: string; fxTwitter: string } | null {
  try {
    const parsed = new URL(tweetUrl);
    // Extract /{username}/status/{id} pattern
    const match = parsed.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
    if (!match) return null;

    const [, username, tweetId] = match;
    return {
      vxTwitter: `https://api.vxtwitter.com/${username}/status/${tweetId}`,
      fxTwitter: `https://api.fxtwitter.com/${username}/status/${tweetId}`,
    };
  } catch {
    return null;
  }
}

/**
 * Extract first image URL from vxTwitter API response
 */
function extractImageFromVxTwitter(data: VxTwitterResponse): string | null {
  // Check media_extended first for more detail
  if (data.media_extended && data.media_extended.length > 0) {
    // Find the first image (not video)
    const image = data.media_extended.find(m => m.type === 'image' || m.type === 'photo');
    if (image?.url) {
      return image.url;
    }
    // If no image, try video thumbnail
    const video = data.media_extended.find(m => m.type === 'video');
    if (video?.thumbnail_url) {
      return video.thumbnail_url;
    }
  }

  // Fallback to mediaURLs array
  if (data.mediaURLs && data.mediaURLs.length > 0) {
    // Find first image URL (ends with .jpg, .png, etc. or is from pbs.twimg.com)
    const imageUrl = data.mediaURLs.find(url =>
      url.includes('pbs.twimg.com') && !url.includes('.mp4') && !url.includes('/video/')
    );
    return imageUrl || null;
  }

  return null;
}

/**
 * Extract first image URL from fxTwitter API response
 */
function extractImageFromFxTwitter(data: FxTwitterResponse): string | null {
  const photos = data.tweet?.media?.photos;
  if (photos && photos.length > 0) {
    return photos[0].url;
  }
  return null;
}

/**
 * Fetch tweet data via third-party APIs and extract image URL
 * Uses vxTwitter as primary and fxTwitter as fallback
 */
async function extractImageFromTweet(tweetUrl: string): Promise<string> {
  // Validate tweet URL format
  if (!isTweetUrl(tweetUrl)) {
    throw new Error(
      'Invalid tweet URL. Please provide a link like x.com/username/status/123...'
    );
  }

  // Get API URLs
  const apiUrls = getTweetApiUrls(tweetUrl);
  if (!apiUrls) {
    throw new Error('Could not parse tweet URL');
  }

  // Try vxTwitter API first
  try {
    const vxResponse = await fetch(apiUrls.vxTwitter, {
      headers: {
        'User-Agent': API_UA,
        Accept: 'application/json',
      },
    });

    if (vxResponse.ok) {
      const data: VxTwitterResponse = await vxResponse.json();
      const imageUrl = extractImageFromVxTwitter(data);
      if (imageUrl) {
        // Validate and normalize
        if (!isAllowedImageHost(imageUrl)) {
          console.warn(`Extracted image URL from unexpected host: ${imageUrl}`);
        }
        return normalizeToOriginalQuality(imageUrl);
      }
    }
  } catch (error) {
    console.warn('vxTwitter API failed:', error);
  }

  // Try fxTwitter API as fallback
  try {
    const fxResponse = await fetch(apiUrls.fxTwitter, {
      headers: {
        'User-Agent': API_UA,
        Accept: 'application/json',
      },
    });

    if (fxResponse.ok) {
      const data: FxTwitterResponse = await fxResponse.json();
      const imageUrl = extractImageFromFxTwitter(data);
      if (imageUrl) {
        // Validate and normalize
        if (!isAllowedImageHost(imageUrl)) {
          console.warn(`Extracted image URL from unexpected host: ${imageUrl}`);
        }
        return normalizeToOriginalQuality(imageUrl);
      }
    }
  } catch (error) {
    console.warn('fxTwitter API failed:', error);
  }

  // If both APIs failed or returned no image
  throw new Error(
    'No image found in this tweet. The tweet may not contain an image, or it may be a video-only tweet.'
  );
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
