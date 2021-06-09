const Key = {
  /* Store */
  USERS_INFO: 'users_info',
  HOLIDAYS: 'Holidays',
  TEAMS: 'TEAMS',
  TeamNames: 'TeamNames',
  TEAM_CHAT: 'TeamChat',
  CONFIG: 'Config',
  TEMP_MESSAGES: 'TempMessages',
  NO_TEAM: 'NoTeam',
};

function storeKey(key) {
  return key.replace(/[@.]/g, '_');
}

class Store {
  private static source: any = PropertiesService.getScriptProperties();

  static set(key, value) {
    key = storeKey(key);
    Store.source.setProperty(key, JSON.stringify(value));
    return value;
  }

  static get(key, defaultValue = null) {
    key = storeKey(key);
    const value = Store.source.getProperty(key);
    return value === undefined || value === null ? defaultValue : JSON.parse(value);
  }

  static getOrSet(key, valueGetter) {
    return Store.get(key) || Store.set(key, valueGetter());
  }

  static remove(key) {
    key = storeKey(key);
    Store.source.deleteProperty(key);
  }
}
