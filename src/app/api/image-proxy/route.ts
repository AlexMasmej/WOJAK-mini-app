import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Only allow Twitter image CDN and avatar services
const ALLOWED_HOSTS = ['pbs.twimg.com', 'unavatar.io'];

// Maximum image size: 10MB
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

// Allowed content types
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/**
 * Validate that URL is from an allowed host
 */
function isAllowedHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get URL from query parameter
    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL parameter is required' },
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

    // Validate hostname is in allowlist
    if (!isAllowedHost(url)) {
      return NextResponse.json(
        {
          success: false,
          error: `Only images from ${ALLOWED_HOSTS.join(', ')} are allowed`,
        },
        { status: 403 }
      );
    }

    // Fetch the image
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch image (HTTP ${response.status})`,
        },
        { status: response.status }
      );
    }

    // Check content type
    const contentType = response.headers.get('content-type')?.split(';')[0];
    if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid content type: ${contentType || 'unknown'}`,
        },
        { status: 400 }
      );
    }

    // Check content length if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Image too large (max 10MB)' },
        { status: 413 }
      );
    }

    // Stream the image with size limit check
    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    const reader = response.body?.getReader();
    if (!reader) {
      return NextResponse.json(
        { success: false, error: 'Failed to read image stream' },
        { status: 500 }
      );
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        totalSize += value.length;
        if (totalSize > MAX_SIZE_BYTES) {
          reader.cancel();
          return NextResponse.json(
            { success: false, error: 'Image too large (max 10MB)' },
            { status: 413 }
          );
        }

        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    // Combine chunks into a single buffer
    const imageBuffer = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      imageBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Return image with appropriate headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(totalSize),
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);

    return NextResponse.json(
      { success: false, error: 'Failed to proxy image' },
      { status: 500 }
    );
  }
}
