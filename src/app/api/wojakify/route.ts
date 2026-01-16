import { NextRequest, NextResponse } from 'next/server';
import { WojakifySettings, WojakArchetype } from '@/types';
import { createStylizer } from '@/lib/stylizers';
import { checkRateLimit } from '@/lib/rate-limit';
import { getImageCache } from '@/lib/cache';

// Config for the route
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout for Vercel

// Allowed MIME types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || realIP || 'unknown';
}

function validateSettings(data: FormData): WojakifySettings {
  const archetype = (data.get('archetype') as string) || 'neutral';
  const simplifyBackground = data.get('simplifyBackground') !== 'false';
  const identityStrength = parseInt(data.get('identityStrength') as string, 10) || 70;

  // Validate archetype
  const validArchetypes: WojakArchetype[] = ['neutral', 'doomer', 'npc', 'chad'];
  if (!validArchetypes.includes(archetype as WojakArchetype)) {
    throw new Error('Invalid archetype');
  }

  // Validate identity strength
  if (identityStrength < 0 || identityStrength > 100) {
    throw new Error('Identity strength must be between 0 and 100');
  }

  return {
    archetype: archetype as WojakArchetype,
    simplifyBackground,
    identityStrength: Math.max(0, Math.min(100, identityStrength)),
  };
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(clientIP);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetIn / 1000)),
            'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)),
          },
        }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No image provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file type. Allowed: JPG, PNG, WebP',
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: 'File too large. Maximum size: 10MB',
        },
        { status: 400 }
      );
    }

    // Validate settings
    let settings: WojakifySettings;
    try {
      settings = validateSettings(formData);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Invalid settings',
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Check cache
    const cache = getImageCache();
    const cachedResult = cache.get(imageBuffer, settings);

    if (cachedResult) {
      return NextResponse.json(
        {
          success: true,
          imageBase64: cachedResult,
          cached: true,
        },
        {
          headers: {
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-Cache': 'HIT',
          },
        }
      );
    }

    // Process image with stylizer
    const stylizer = createStylizer();
    const result = await stylizer.stylize({
      imageBuffer,
      mimeType: file.type,
      settings,
    });

    // Convert result to base64
    const resultBase64 = result.imageBuffer.toString('base64');

    // Cache the result
    cache.set(imageBuffer, settings, resultBase64);

    return NextResponse.json(
      {
        success: true,
        imageBase64: resultBase64,
        cached: false,
      },
      {
        headers: {
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-Cache': 'MISS',
        },
      }
    );
  } catch (error) {
    console.error('Wojakify API error:', error);

    // Don't expose internal errors to client
    const message =
      error instanceof Error && error.message.includes('API')
        ? 'AI service temporarily unavailable. Please try again.'
        : 'An unexpected error occurred. Please try again.';

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
