const { createClient } = require('redis');

class CacheService {
  constructor() {
    this.useRedis = !!process.env.REDIS_URL;
    this.localCache = new Map(); // In-memory fallback
    
    if (this.useRedis) {
      this.client = createClient({ url: process.env.REDIS_URL });
      
      this.client.on('error', (err) => console.error('Redis Client Error', err));
      
      this.client.connect()
        .then(() => console.log('Redis Cache Connected'))
        .catch(err => console.error('Redis connection failed:', err));
    } else {
      console.log('No REDIS_URL found. Caching mechanism falling back to local In-Memory Map.');
    }
  }

  // Get data from cache
  async get(key) {
    if (this.useRedis) {
      try {
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
      } catch (e) {
        console.error("Redis Get Error:", e);
        return null; // Fallback to missing cache if redis fails
      }
    } else {
      const item = this.localCache.get(key);
      if (!item) return null;
      
      // Check expiration
      if (item.expiry < Date.now()) {
        this.localCache.delete(key);
        return null;
      }
      return item.value;
    }
  }

  // Set data in cache (TTL is in seconds)
  async set(key, value, ttlSeconds = 86400) { // Default 24 hours
    if (this.useRedis) {
      try {
        await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
      } catch (e) {
        console.error("Redis Set Error:", e);
      }
    } else {
      this.localCache.set(key, {
        value,
        expiry: Date.now() + (ttlSeconds * 1000)
      });
    }
  }
}

module.exports = new CacheService();
