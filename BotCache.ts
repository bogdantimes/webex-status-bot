type BotCacheKey = {
  STATUSES_ASKED_TODAY: string;
  USERS_WITHOUT_STATUS: string;
  STATUSES_COLLECTED: string;
  DAILY_STATUSES: string;
  statusDropTime: (user: string) => string;
  dailyStatus: (user: string) => string;
}

class BotCache {
  static cache: any = CacheService.getScriptCache();

  static MAX_EXPIRATION: number = 21600; // 6 hours;

  static Key: BotCacheKey = {
    STATUSES_COLLECTED: 'STATISTICS_UPDATED_TODAY',
    STATUSES_ASKED_TODAY: 'STATUSES_ASKED_TODAY',
    DAILY_STATUSES: 'DAILY_STATUSES',
    USERS_WITHOUT_STATUS: 'USERS_WITHOUT_STATUS',

    dailyStatus: user => 'DailyStatus_' + user,
    statusDropTime: user => 'StatusDropTime_' + user,
  };

  static put(key, value, expirationInSeconds = BotCache.MAX_EXPIRATION) {
    this.cache.remove(key);
    if (value) {
      this.cache.put(key, JSON.stringify(value), expirationInSeconds);
    }
    return value;
  }

  static get(key, defaultValue = null) {
    try {
      const value = BotCache.cache.get(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  /**
   * Gets value from the cache or if absent, puts the value from valueGetter and returns it.
   * @param key {string}
   * @param valueGetter {function}
   * @param expirationInSeconds {int}
   * @returns {any}
   */
  static getOrPut(key, valueGetter, expirationInSeconds = BotCache.MAX_EXPIRATION) {
    return BotCache.get(key) || BotCache.put(key, valueGetter(), expirationInSeconds);
  }

  static remove(key) {
    BotCache.cache.remove(key);
  }
}
