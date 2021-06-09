function Bot_Init() {
  WebexClient().deleteAllWebHooks();
  WebexClient().createWebHook();
}

function Bot_Restart() {
  WebexClient().deleteAllWebHooks();
  WebexClient().createWebHook();

  checkTriggers();
  debugMessage('Bot restarted.');
}

function Bot_Stop() {
  WebexClient().deleteAllWebHooks();
  debugMessage('Bot stopped.');
}

function Bot_AskStatuses(options) {
  const manualCall = !options || options && options.manualCall;
  const statusesAskedToday = BotCache.get(BotCache.Key.STATUSES_ASKED_TODAY);

  if (manualCall || !statusesAskedToday) {
    const usersInfo = Bot_CollectUsersInfo();
    const webexClient = WebexClient();

    const dailyStatusesData = BotUtils.collectDailyStatusesData(usersInfo.workingToday, webexClient);
    const statuses = dailyStatusesData.statuses;
    const usersWithoutStatus = dailyStatusesData.userStatusIssues.noStatus;

    let errorOccurred = false;

    if (Object.keys(statuses).length) {
      webexClient.sendMessageToRoom(MainConfig.operationsRoomId, 'Some developers already have a status');
    }
    Object.keys(statuses).forEach(user => {
      const dailyStatus = statuses[user];
      webexClient.sendMessageToRoom(MainConfig.operationsRoomId, dailyStatus);
      const firstName = BotUtils.getUserFirstName(user, webexClient);
      const gotStatusReply = fmt(
        'Hey, %s. You can send me a final version of your daily status before the moment they are collected.  \n' +
        'Use `show status` at any time to check it.  \n' +
        'Read the rules at %s.', firstName, getHelpPage());
      try {
        webexClient.sendMessageToPerson(user, gotStatusReply);
      } catch (e) {
        errorOccurred = true;
        console.error('Failed to send "your status" message to ' + user);
      }
    });

    usersWithoutStatus.forEach(user => {
      const askStatusReply = fmt(
        'Please, send your daily status before the moment they are collected.  \n' +
        'You can use `show status` at any time to check it.  \n' +
        'Read the rules at %s.', getHelpPage());
      try {
        webexClient.sendMessageToPerson(user, askStatusReply);
      } catch (e) {
        errorOccurred = true;
        console.error('Failed to send "send me status" message to ' + user);
      }
    });

    BotCache.put(BotCache.Key.STATUSES_ASKED_TODAY, true);

    if (errorOccurred) {
      debugMessage('Ask Statuses finished with errors.');
    }
  }
}

function Bot_CheckStatuses(options) {
  const statusesCollected = BotCache.get(BotCache.Key.STATUSES_COLLECTED);
  const manualCall = !options || options && options.manualCall;
  const webexClient = WebexClient();

  if (!statusesCollected && options && !options.manualCall) {
    webexClient.sendMessageToRoom(MainConfig.operationsRoomId, 'Collecting daily statuses...');
  }

  if (manualCall || !statusesCollected) {
    const usersInfo = Bot_CollectUsersInfo();
    const usersWorkingToday = usersInfo.workingToday;

    const dailyStatusesData = BotUtils.collectDailyStatusesData(usersWorkingToday, webexClient);
    const statuses = dailyStatusesData.statuses;
    const usersWithoutStatus = dailyStatusesData.userStatusIssues.noStatus;

    Reporter.notifyHowManyMissed(usersWithoutStatus, usersWorkingToday.length, webexClient);
    Reporter.sendReportAsChatMessage(dailyStatusesData, usersInfo, webexClient);

    if (!usersWithoutStatus.length) {
      Reporter.sendReportAsEmail(statuses, webexClient);
      BotCache.put(BotCache.Key.STATUSES_COLLECTED, true);
    } else {
      usersWithoutStatus.forEach(user => {
        const name = BotUtils.getUserFirstName(user, webexClient);
        webexClient.sendMessageToPerson(user,
          `${warning} ${name}, I cannot send the final report without your daily status.  \n` +
          'Please, send it as soon as possible!');
      });
      BotCache.put(BotCache.Key.USERS_WITHOUT_STATUS, usersWithoutStatus);
    }
  }
}

function Bot_CollectUsersInfo(optParams?) {
  const webexClient = WebexClient();
  const usersInfo = BotUtils.getTeamMembersInfo(webexClient);
  BotCache.put(Key.USERS_INFO, usersInfo, 3600); // one hour
  // console.log('Collected users info and put to Cache', usersInfo);
  if (optParams && optParams.replyToRoom) {
    Reporter.sendUsersInfoToRoom(usersInfo, optParams.replyToRoom, webexClient);
  }
  return usersInfo;
}

function Bot_SendLastCallToUpdateDailyStatus() {
  const webexClient = WebexClient();
  const usersInfo = Bot_CollectUsersInfo();
  const dailyStatusesData = BotUtils.collectDailyStatusesData(usersInfo.workingToday, webexClient);

  Object.keys(dailyStatusesData.statuses).forEach(function (user) {
    try {
      if (dailyStatusesData.userStatusIssues.lackOfDetails.includes(user)) {
        webexClient.sendMessageToPerson(user,
          `${warning} Your current daily status lacks details. **You must make it more descriptive.**`);
      }

      const dailyStatus = dailyStatusesData.statuses[user];
      const haveStatusMessage = fmt(
        'I’m gonna use this as your today\'s status:\n\n%s\n\n' +
        'Hurry up if you want to update it.', dailyStatus);
      webexClient.sendMessageToPerson(user, haveStatusMessage);
    } catch (e) {
      console.error('Failed to send "last call" message to ' + user);
    }
  });

  dailyStatusesData.userStatusIssues.noStatus.forEach(user => {
    try {
      const firstName = BotUtils.getUserFirstName(user, webexClient);
      const teamChat = BotUtils.getTeamChat(user);
      const fullName = BotUtils.getUserFullName(user, webexClient);
      let gotTeamChatError;
      if (teamChat) {
        try {
          const troubleGif = GiphyClient.getRandomGifByTag(getRandomFromList(['alert', 'warning']));
          const msg = `${warning} **${fullName}** has no daily status!\n\n<@all>`;
          if (troubleGif) {
            webexClient.sendAttachment({roomId: teamChat}, troubleGif, msg);
          } else {
            webexClient.sendMessageToRoom(teamChat, msg);
          }
          debugMessage('sent last call warning for ' + user + ' to team chat');
        } catch (e) {
          debugMessage('failed to send warning to team chat');
          gotTeamChatError = true;
        }
      }

      if (!teamChat || gotTeamChatError) {
        const teamLead = BotUtils.getTeamLeadFor(user);
        if (teamLead) {
          webexClient.sendMessageToPerson(teamLead,
            `${warning} **${fullName}** has no daily status!\n\n` +
            'I can send such notifications into your team chat. Please, add me and there send the command `its our chat`.');
          debugMessage('sent last call warning for ' + user + ' to team lead');
        }
      }

      const noStatusMessage =
        `${warning} ${firstName}, you haven’t left your daily status.  \nThis is the last chance to do it. Hurry up!`;
      webexClient.sendMessageToPerson(user, noStatusMessage);
    } catch (e) {
      debugMessage('Failed to send "hurry up" message to ' + user);
    }
  });
}
