type Config = {
  /**
   * Required.
   * Bot name in webex. Used across the code.
   */
  botName: string
  /**
   * Required.
   * Bot email in webex. Used across the code.
   */
  botEmail: string
  /**
   * Bot admins in webex
   */
  admins: string[]
  /**
   * Webex bot token required
   */
  botAuthToken: string
  /**
   * The Google Apps Script webapp URL
   */
  webAppHook: string
  /**
   * At least one email required.
   * Team leads are added to the daily report email CC automatically.
   */
  dailyReportTo: string[]
  /**
   * Managers are added to the daily report email CC.
   * Also, managers are allowed to execute adminsOnly bot PublicCommands.
   */
  managers: string[]

  /**
   * Id of the Webex space for daily status related notifications from bot.
   */
  dailyStatusRoomId: string

  /**
   * Id of the Webex space for bot operation related notifications from bot.
   */
  operationsRoomId: string

  /**
   * Id of the Webex space for debug messages from bot.
   */
  debugRoomId: string

  /**
   * URL for the Help page with information for users.
   */
  helpPageUrl: string
};

class MainConfig {
  private static __config: Config;

  private static defaultConfig: Config = {
    botName: 'NotSpecified',
    botEmail: 'NotSpecified',
    admins: ['NotSpecified'],
    botAuthToken: 'NotSpecified',
    webAppHook: 'NotSpecified',
    dailyReportTo: [],
    managers: [],
    dailyStatusRoomId: 'NotSpecified',
    operationsRoomId: 'NotSpecified',
    debugRoomId: 'NotSpecified',
    helpPageUrl: 'NotSpecified',
  };

  // @ts-ignore
  static get botName(): string {
    return MainConfig.get().botName;
  }

  // @ts-ignore
  static get botEmail(): string {
    return MainConfig.get().botEmail;
  }

  // @ts-ignore
  static get admins(): string[] {
    return MainConfig.get().admins;
  }

  // @ts-ignore
  static get calmBotAuthToken(): string {
    return MainConfig.get().botAuthToken;
  }

  // @ts-ignore
  static get webAppHook(): string {
    return MainConfig.get().webAppHook;
  }

  // @ts-ignore
  static get dailyReportTo(): string[] {
    return MainConfig.get().dailyReportTo;
  }

  // @ts-ignore
  static get managers(): string[] {
    return MainConfig.get().managers;
  }

  // @ts-ignore
  static get dailyStatusRoomId(): string {
    return MainConfig.get().dailyStatusRoomId;
  }

  // @ts-ignore
  static get operationsRoomId(): string {
    return MainConfig.get().operationsRoomId;
  }

  // @ts-ignore
  static get debugRoomId(): string {
    return MainConfig.get().debugRoomId;
  }

  // @ts-ignore
  static get helpPageUrl(): string {
    return MainConfig.get().helpPageUrl;
  }

  static get(): Config {
    if (!MainConfig.__config) {
      const config = Store.get(Key.CONFIG, {});

      MainConfig.__config = Object.assign(MainConfig.defaultConfig, config)

      Store.set(Key.CONFIG, MainConfig.__config)
    }
    return MainConfig.__config;
  }
}
