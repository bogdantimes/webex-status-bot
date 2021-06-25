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
    const selectedKeys = Store.source.getKeys().filter(k => k.startsWith(`${key}/`))
    if (selectedKeys.length) {
      // Iterate over selected keys that match `key/` and aggregate the result into an object.
      // TODO: rewrite to support > 1 nested levels
      return selectedKeys.reduce((props, k) => {
        const val = Store.source.getProperty(k);
        const subKey = k.split(`${key}/`)[1];
        props[subKey] = val === undefined || val === null ? defaultValue : JSON.parse(val);
        return props;
      }, {})
    } else {
      const value = Store.source.getProperty(key);
      return value === undefined || value === null ? defaultValue : JSON.parse(value);
    }
  }

  static getOrSet(key, valueGetter) {
    return Store.get(key) || Store.set(key, valueGetter());
  }

  static remove(key) {
    key = storeKey(key);
    Store.source.deleteProperty(key);
    Store.source.getKeys().filter(k => k.startsWith(`${key}/`)).forEach(k => Store.source.deleteProperty(k));
  }
}
