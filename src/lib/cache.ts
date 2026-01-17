import crypto from 'crypto';
import { WojakifySettings } from '@/types';

interface CacheEntry {
  imageBase64: string;
  expiresAt: number;
}

// In-memory cache for generated images
// For production with multiple instances, use Redis or similar
class ImageCache {
  private store: Map<string, CacheEntry> = new Map();
  private ttlMs: number;
  private maxSize: number = 500; // Maximum number of cached images

  constructor() {
    // Default 24 hours - same image+settings = same result, no need to regenerate
    const ttlSeconds = parseInt(process.env.CACHE_TTL_SECONDS || '86400', 10);
    this.ttlMs = ttlSeconds * 1000;

    // Clean up expired entries every 30 seconds
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 30000);
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  private generateKey(imageBuffer: Buffer, settings: WojakifySettings): string {
    const hash = crypto.createHash('sha256');
    hash.update(imageBuffer);
    hash.update(JSON.stringify(settings));
    return hash.digest('hex').substring(0, 32);
  }

  get(imageBuffer: Buffer, settings: WojakifySettings): string | null {
    const key = this.generateKey(imageBuffer, settings);
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.imageBase64;
  }

  set(imageBuffer: Buffer, settings: WojakifySettings, resultBase64: string): void {
    const key = this.generateKey(imageBuffer, settings);

    // Enforce max size by removing oldest entries
    if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      imageBase64: resultBase64,
      expiresAt: Date.now() + this.ttlMs,
    });
  }
}

// Singleton instance
let imageCache: ImageCache | null = null;

export function getImageCache(): ImageCache {
  if (!imageCache) {
    imageCache = new ImageCache();
  }
  return imageCache;
}
