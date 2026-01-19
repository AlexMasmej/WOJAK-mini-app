import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// User agent for API requests
const API_UA = 'WOJAK-mini-app/1.0';

interface GetProfilePicRequest {
  username: string;
}

interface GetProfilePicResponse {
  success: boolean;
  imageUrl?: string;
  username?: string;
  error?: string;
}

/**
 * Validate and clean Twitter/X username
 * Accepts: @username, username, or profile URL
 */
function parseUsername(input: string): string | null {
  const trimmed = input.trim();

  // Handle profile URLs like x.com/username or twitter.com/username
  try {
    const url = new URL(trimmed);
    if (
      url.hostname === 'x.com' ||
      url.hostname === 'www.x.com' ||
      url.hostname === 'twitter.com' ||
      url.hostname === 'www.twitter.com'
    ) {
      // Extract username from path (first segment after /)
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0 && !['status', 'i', 'intent'].includes(pathParts[0])) {
        return pathParts[0].toLowerCase();
      }
    }
  } catch {
    // Not a URL, continue with username parsing
  }

  // Remove @ prefix if present
  const username = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;

  // Validate username format (alphanumeric and underscores, 1-15 chars)
  const usernameRegex = /^[a-zA-Z0-9_]{1,15}$/;
  if (!usernameRegex.test(username)) {
    return null;
  }

  return username.toLowerCase();
}

/**
 * Fetch profile picture using unavatar.io service
 * This is a free service that aggregates social media avatars
 */
async function fetchProfilePicUrl(username: string): Promise<string> {
  // Use unavatar.io which supports Twitter/X
  const unavatarUrl = `https://unavatar.io/twitter/${username}?fallback=false`;

  // Check if the image exists by making a HEAD request
  const response = await fetch(unavatarUrl, {
    method: 'HEAD',
    headers: {
      'User-Agent': API_UA,
    },
  });

  if (!response.ok) {
    throw new Error('Profile picture not found. The account may be private or doesn\'t exist.');
  }

  // Return the unavatar URL which will redirect to the actual image
  // We use the larger size version
  return `https://unavatar.io/twitter/${username}?size=400`;
}

/**
 * Alternative: Try to get profile pic from vxTwitter by fetching user data
 */
async function fetchProfilePicFromVxTwitter(username: string): Promise<string | null> {
  try {
    // vxTwitter has a user endpoint
    const response = await fetch(`https://api.vxtwitter.com/${username}`, {
      headers: {
        'User-Agent': API_UA,
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.user_profile_image_url) {
        // Get original quality by replacing _normal with _400x400
        return data.user_profile_image_url.replace('_normal', '_400x400');
      }
    }
  } catch {
    // Fallback failed
  }
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse<GetProfilePicResponse>> {
  try {
    // Parse request body
    let body: GetProfilePicRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { username: rawUsername } = body;

    // Validate required fields
    if (!rawUsername || typeof rawUsername !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    // Parse and validate username
    const username = parseUsername(rawUsername);
    if (!username) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid username. Use a valid X handle like @username or just username.'
        },
        { status: 400 }
      );
    }

    // Try to get profile picture
    try {
      // First try vxTwitter for direct Twitter image URL
      const vxImageUrl = await fetchProfilePicFromVxTwitter(username);
      if (vxImageUrl) {
        return NextResponse.json({
          success: true,
          imageUrl: vxImageUrl,
          username,
        });
      }

      // Fallback to unavatar.io
      const imageUrl = await fetchProfilePicUrl(username);

      return NextResponse.json({
        success: true,
        imageUrl,
        username,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch profile picture';

      return NextResponse.json(
        { success: false, error: message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Get profile pic API error:', error);

    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
