interface DailyUsageEntry {
  count: number;
  date: string; // YYYY-MM-DD in UTC
}

// In-memory daily limit tracker
// For production with multiple instances, use Redis or a database
class DailyLimitTracker {
  private store: Map<string, DailyUsageEntry> = new Map();
  private maxGenerationsPerDay: number;

  constructor() {
    this.maxGenerationsPerDay = parseInt(
      process.env.DAILY_GENERATION_LIMIT || '5',
      10
    );

    // Clean up old entries every hour
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 60 * 60 * 1000);
    }
  }

  private getCurrentDateUTC(): string {
    return new Date().toISOString().split('T')[0];
  }

  private cleanup() {
    const today = this.getCurrentDateUTC();
    for (const [key, entry] of this.store.entries()) {
      if (entry.date !== today) {
        this.store.delete(key);
      }
    }
  }

  check(identifier: string): {
    allowed: boolean;
    used: number;
    limit: number;
    remaining: number;
    resetsAt: string;
  } {
    const today = this.getCurrentDateUTC();
    const entry = this.store.get(identifier);

    // Calculate when the limit resets (next midnight UTC)
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const resetsAt = tomorrow.toISOString();

    // New day or new user
    if (!entry || entry.date !== today) {
      return {
        allowed: true,
        used: 0,
        limit: this.maxGenerationsPerDay,
        remaining: this.maxGenerationsPerDay,
        resetsAt,
      };
    }

    const remaining = Math.max(0, this.maxGenerationsPerDay - entry.count);

    return {
      allowed: entry.count < this.maxGenerationsPerDay,
      used: entry.count,
      limit: this.maxGenerationsPerDay,
      remaining,
      resetsAt,
    };
  }

  increment(identifier: string): void {
    const today = this.getCurrentDateUTC();
    const entry = this.store.get(identifier);

    if (!entry || entry.date !== today) {
      // New day or new user
      this.store.set(identifier, {
        count: 1,
        date: today,
      });
    } else {
      entry.count++;
    }
  }
}

// Singleton instance
let dailyLimitTracker: DailyLimitTracker | null = null;

export function getDailyLimitTracker(): DailyLimitTracker {
  if (!dailyLimitTracker) {
    dailyLimitTracker = new DailyLimitTracker();
  }
  return dailyLimitTracker;
}

export function checkDailyLimit(identifier: string) {
  return getDailyLimitTracker().check(identifier);
}

export function incrementDailyUsage(identifier: string) {
  return getDailyLimitTracker().increment(identifier);
}
