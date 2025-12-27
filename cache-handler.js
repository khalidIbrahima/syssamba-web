// Simple cache handler to reduce memory usage
class SimpleCacheHandler {
  constructor() {
    this.cache = new Map();
    this.maxSize = 500; // Limit cache size
  }

  async get(key) {
    return this.cache.get(key) || null;
  }

  async set(key, data) {
    // Limit cache size to reduce memory usage
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, data);
  }

  async revalidateTag() {
    // Clear cache on revalidate to free memory
    this.cache.clear();
  }
}

module.exports = SimpleCacheHandler;
