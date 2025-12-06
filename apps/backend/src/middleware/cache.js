// apps/backend/src/middleware/cache.js
const NodeCache = require('node-cache');

// Create cache instance with default TTL of 60 seconds
const cache = new NodeCache({ 
  stdTTL: 60,
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false, // Don't clone values (faster)
});

/**
 * Cache middleware for GET requests
 * @param {number} duration - Cache duration in seconds (default: 60)
 * @returns {function} Express middleware
 */
const cacheMiddleware = (duration = 60) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key from URL and query params
    const key = `__express__${req.originalUrl || req.url}`;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      // Cache hit - return cached response
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-Key', key);
      return res.json(cachedResponse);
    }

    // Cache miss - store response when sent
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful responses
      if (res.statusCode === 200) {
        cache.set(key, body, duration);
      }
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', key);
      return originalJson(body);
    };

    next();
  };
};

/**
 * Clear cache by pattern
 * @param {string} pattern - Pattern to match cache keys (e.g., 'dashboard')
 */
const clearCache = (pattern) => {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  matchingKeys.forEach(key => cache.del(key));
  console.log(`🗑️ Cleared ${matchingKeys.length} cache entries matching: ${pattern}`);
  return matchingKeys.length;
};

/**
 * Clear all cache
 */
const clearAllCache = () => {
  cache.flushAll();
  console.log('🗑️ Cleared all cache');
};

/**
 * Get cache statistics
 */
const getCacheStats = () => {
  return cache.getStats();
};

module.exports = {
  cacheMiddleware,
  clearCache,
  clearAllCache,
  getCacheStats,
  cache, // Export cache instance for direct access if needed
};
