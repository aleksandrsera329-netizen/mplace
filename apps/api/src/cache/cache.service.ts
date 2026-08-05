import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private readonly prefix = 'mplace:';

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL');

    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        connectTimeout: 5000,
        lazyConnect: true,
        enableOfflineQueue: false,
      });

      this.redis.on('connect', () => this.logger.log('Redis connected'));
      this.redis.on('error', (err) =>
        this.logger.error(`Redis error: ${err.message}`),
      );

      // Connect in background — failures must not block boot
      void this.redis.connect().catch((e) => {
        this.logger.warn(
          `Redis connect failed — cache disabled: ${(e as Error).message}`,
        );
        this.redis = null;
      });
    } else {
      this.logger.warn('REDIS_URL not set — cache disabled');
    }
  }

  get enabled() {
    return !!this.redis;
  }

  private key(key: string) {
    return `${this.prefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      if (this.redis.status !== 'ready') {
        await this.redis.connect().catch(() => null);
      }
      const data = await this.redis.get(this.key(key));
      return data ? (JSON.parse(data) as T) : null;
    } catch (e) {
      this.logger.error(`Cache get error: ${key}`, e as Error);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    if (!this.redis) return;
    try {
      if (this.redis.status !== 'ready') {
        await this.redis.connect().catch(() => null);
      }
      await this.redis.set(
        this.key(key),
        JSON.stringify(value),
        'EX',
        ttlSeconds,
      );
    } catch (e) {
      this.logger.error(`Cache set error: ${key}`, e as Error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(this.key(key));
    } catch (e) {
      this.logger.error(`Cache del error: ${key}`, e as Error);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!this.redis) return;
    try {
      const keys = await this.redis.keys(this.key(pattern));
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (e) {
      this.logger.error(`Cache delByPattern error: ${pattern}`, e as Error);
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        this.redis.disconnect();
      }
      this.redis = null;
    }
  }
}
