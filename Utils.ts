const BotUtils = {

  listUsers(roomId, webexClient) {
    return webexClient
      .listRoomMembers(roomId)
      .reduce((realUsers, member) => {
        if (BotUtils.isRealMember(member)) {
          realUsers.push(member.personEmail);
        }
        return realUsers;
      }, []);
  },

  listAllTeamMembers(): string[] {
    const teams = Store.get(Key.TEAMS, {});
    const noTeam = Store.get(Key.NO_TEAM, []);
    return Object
      .keys(teams)
      .reduce((all, key) => all.concat(teams[key]), [])
      .concat(noTeam);
  },

  isRealMember(member) {
    const notMonitor = !member.isMonitor;
    return notMonitor && !BotUtils.isBot(member.personEmail);
  },

  isBot(user) {
    return user.endsWith('sparkbot.io') || user.endsWith('webex.bot');
  },

  isInTeam(user, optTeams = null) {
    return !!BotUtils.getTeamName(user, optTeams);
  },

  getTeamName(user, optTeams = null) {
    const teams = optTeams || Store.get(Key.TEAMS, {});
    return Object.keys(teams).filter(teamName =>
      teams[teamName].some(teammate => teammate === user))[0];
  },

  getTeamChat(user) {
    return BotCache.getOrPut(`getTeamChat_${user}`, () => {
      const teamName = BotUtils.getTeamName(user);
      return teamName ? Store.get(Key.TEAM_CHAT + '/' + teamName) : null;
    }, SEC_IN_ONE_HOUR);
  },

  getTeamNameByRoom(roomId) {
    const teamChats = Store.get(Key.TEAM_CHAT, {});
    return Object.keys(teamChats).filter(k => teamChats[k] === roomId)[0];
  },

  isTeamLead(user) {
    return BotUtils.getTeamLeads().includes(user);
  },

  getTeamLeadFor(user) {
    const teamName = BotUtils.getTeamName(user);
    if (teamName) {
      const team = Store.get(Key.TEAMS + '/' + teamName, []);
      const teamLead = team[0];
      if (teamLead !== user) {
        return teamLead;
      }
    }
  },

  isMessageFromAdmin(user, webexClient) {
    return MainConfig.admins.includes(user) ||
      MainConfig.managers.includes(user) ||
      BotUtils.isTeamLead(user);
  },

  sendStatusesReportNoCheck(webexClient) {
    const usersInfo = Bot_CollectUsersInfo();
    const dailyStatusesData = BotUtils.collectDailyStatusesData(usersInfo.workingToday, webexClient);
    Reporter.sendReportAsEmail(dailyStatusesData.statuses, webexClient);
  },

  collectDailyStatusesData(users, webexClient) {
    const statuses = {};
    const userStatusIssues = {
      lackOfDetails: [],
      noStatus: [],
    };
    const workedTasks = {};

    const teams = Store.get(Key.TEAMS, {});
    users
      .filter(u => BotUtils.isInTeam(u, teams))
      .forEach(user => {
        const processedStatus = BotUtils.getCustomDailyStatus(user, webexClient);
        if (processedStatus) {
          statuses[user] = processedStatus.forReport;
          workedTasks[user] = processedStatus.workedTasks;
          if (!processedStatus.statusIsFine) {
            userStatusIssues.lackOfDetails.push(user);
          }
        } else {
          userStatusIssues.noStatus.push(user);
        }
      });
    return {
      workedTasks: workedTasks,
      statuses: statuses,
      userStatusIssues: userStatusIssues,
    };
  },

  getCustomDailyStatus(user, webexClient) {
    const dailyStatus = BotCache.get(BotCache.Key.dailyStatus(user));

    if (dailyStatus) {
      return dailyStatus;
    }

    const userMessagesToBot = webexClient.listOneToOneMessages(user, 50).filter(m => m.personEmail === user);
    const dailyStatusCandidateMessage = BotUtils.findDailyStatusCandidateMessage(userMessagesToBot);
    const rawStatus = dailyStatusCandidateMessage && BotUtils.isInTimeRange(user, dailyStatusCandidateMessage)
      ? dailyStatusCandidateMessage.text.trim() : null;
    return rawStatus ? BotUtils.processDailyStatus(user, rawStatus, webexClient) : null;
  },

  isInTimeRange(user, dailyStatusCandidateMessage) {
    const dropTime = BotCache.get(BotCache.Key.statusDropTime(user), 0);
    return new Date(dropTime).getTime() < new Date(dailyStatusCandidateMessage.created).getTime();
  },

  processDailyStatus(user, rawStatus, webexClient) {
    const forReport = appendMissingDot(rawStatus);

    return {
      rawStatus: rawStatus,
      forReport: forReport,
      statusIsFine: rawStatus.length >= Constants.MIN_STATUS_LENGTH,
    };
  },

  findDailyStatusCandidateMessage(messages) {
    const privateCommands = PrivateCommands();
    const dailyStatusCandidates = messages
      .filter(message => isToday(message.created) && privateCommands
        .every(command => !command.match(message.text, message)));
    return dailyStatusCandidates[0];
  },

  getUserFullName(user, webexClient) {
    const userDetails = webexClient.getUserDetails(user);
    return userDetails ? userDetails.displayName : 'Unknown Unicorn';
  },

  /**
   * @example John D.
   */
  getUserShortName(user, webexClient) {
    const fullNameSplit = BotUtils.getUserFullName(user, webexClient).split(' ');
    return `${fullNameSplit[0]} ${fullNameSplit[1][0]}.`;
  },

  getUserFirstName(user, webexClient) {
    const fullName = BotUtils.getUserFullName(user, webexClient);
    return fullName.split(' ')[0];
  },

  groupDailyStatusUsersByListedUsers(listedUsers, webexClient) {
    const allUsers = BotUtils.listUsers(MainConfig.dailyStatusRoomId, webexClient);
    return BotUtils.groupKnownUnknownUsers(listedUsers, allUsers);
  },

  groupKnownUnknownUsers(users, allUsers) {
    const notInUsers = without(allUsers, users);

    const unknownUsers = [], knownUsers = [];

    users.forEach(user => {
      if (allUsers.includes(user)) {
        knownUsers.push(user);
      } else {
        unknownUsers.push(user);
      }
    });

    return {
      notInUsers: notInUsers,
      knownUsers: knownUsers,
      unknownUsers: unknownUsers,
    };
  },

  getTeamMembersInfo(webexClient) {
    const allUsers = BotUtils.listAllTeamMembers();
    const notWorkingToday = {};

    allUsers
      .filter(user => webexClient.getUserDetails(user).status == 'OutOfOffice')
      .forEach(user => notWorkingToday[user] = "Out Of Office ✈️")

    return {
      workingToday: without(allUsers, Object.keys(notWorkingToday)),
      notWorkingToday: Object.keys(notWorkingToday).map(user => ({user, reason: notWorkingToday[user]})),
    };
  },

  sendDefaultCommandHandledReply(commandName, commandMessage, webexClient) {
    const reply = fmt('%s, okay, I’m gonna **%s** now...', mention(commandMessage.personEmail), commandName);
    webexClient.sendMessageToRoom(commandMessage.roomId, reply);
  },

  sendFastCommandReply(commandMessage, webexClient) {
    const reply = fmt('%s, okay, give me a second...', mention(commandMessage.personEmail));
    webexClient.sendMessageToRoom(commandMessage.roomId, reply);
  },

  sendDefaultCommandDoneReply(commandMessage, webexClient) {
    const reply = fmt('%s, done!', mention(commandMessage.personEmail));
    webexClient.sendMessageToRoom(commandMessage.roomId, reply);
  },

  getTeamLeads() {
    const teams = Store.get(Key.TEAMS, {});
    return Object.values(teams).map(members => members[0]);
  }
};

function deleteProjectTriggers() {
  ScriptApp.getProjectTriggers().forEach(trigger => ScriptApp.deleteTrigger(trigger));
}

function mention(user) {
  return `<@personEmail:${user}>`;
}

function checkTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  const result = triggers.reduce((text, trigger) =>
    text + '  \n' + trigger.getHandlerFunction(), 'Total: ' + triggers.length);
  debugMessage(result);
}

function getMonthLong(date?) {
  const _date = new Date() || date;
  return _date.toLocaleString('en-us', {month: 'long'}).match(/\w+/)[0];
}

let holidays = null;

function isHoliday(date) {
  if (!holidays) {
    holidays = Store.get(Key.HOLIDAYS, []);
  }
  return holidays.includes(formatDate(date));
}

function isWorkDay(date) {
  return !isWeekEnd(date) && !isHoliday(date);
}

function isWeekEnd(date) {
  return isSaturday(date) || isSunday(date);
}

function isSaturday(date) {
  const day = (date || new Date()).getDay();
  return day === 6;
}

function isSunday(date) {
  const day = (date || new Date()).getDay();
  return day === 0;
}

function isDayEqual(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
}

function isToday(date) {
  return isDayEqual(new Date(date), new Date());
}

function debugMessage(text) {
  console.log(`DEBUG_MSG: ${text}`)
  try {
    WebexClient({debug: true, requestAttempts: 1}).sendDebugMessage(text);
  } catch (e) {
    console.error(`Debug msg failed: ${e}`)
  }
}

function debugObject(obj) {
  debugMessage(JSON.stringify(obj));
}

function printObject(object) {
  return Object.keys(object).reduce((msg, key) => {
    msg += `**${key}**: ${object[key]}  \n`;
    return msg;
  }, '');
}

function getHelpPage() {
  return fmt(`[${MainConfig.botName} Help Page](%s)`, MainConfig.helpPageUrl);
}
