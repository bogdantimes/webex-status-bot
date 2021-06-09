function replyThatUserNotWorking(user, webexClient) {
  let reason;
  if (BotUtils.isInTeam(user)) {
    reason = 'Looks like you’re not working today';
  } else {
    reason = 'Looks like you‘re not in a team';
  }
  webexClient.sendMessageToPerson(user, `${warning} ${reason}. Please, contact your team-lead/manager.`);
}

function matchCmd(cmd) {
  const abbrev = getFirstLetters(cmd);
  const reg = new RegExp(`^${abbrev}|${cmd}$`, 'i');
  return commandText => commandText.trim().match(reg);
}

function printCmd(cmd) {
  const abbrev = getFirstLetters(cmd);
  return `**${abbrev}** or **${cmd.toLowerCase()}**`;
}

const PrivateCommands = () => [
  {
    name: 'Hi',
    match(commandText) {
      return commandText.match(/^(hello|hi|hey|привет)$/i);
    },
    evaluate(commandMessage, webexClient) {
      webexClient.sendMessageToPersonNoSwitch(commandMessage.personEmail, 'Hi...');
    },
  },
  {
    name: 'Help',
    match: matchCmd('help'),
    evaluate(commandMessage, webexClient) {
      const commands = PrivateCommands().filter(c => c.description).map(c => c.description).join('  \n');
      webexClient.sendMessageToPerson(commandMessage.personEmail, `Here are some of the commands you can use:  \n${commands}`);
      webexClient.sendMessageToPerson(commandMessage.personEmail,
        fmt('If you need additional information, please visit %s.\n\n' +
          'The help content is in development, any contribution will be much appreciated.  \n' +
          'You can leave your comments there.', getHelpPage()));
    },
  },
  {
    name: 'Show status',
    description: `${printCmd('show status')} - to check your current daily status`,
    match: matchCmd('show status'),
    evaluate(commandMessage, webexClient) {
      const temporary = true;
      const user = commandMessage.personEmail;

      if (temporary) {
        webexClient.deleteTemporaryMessages(user);
      }

      const statusesData = BotUtils.collectDailyStatusesData([user], webexClient);
      const customStatus = statusesData.statuses[user];

      if (statusesData.userStatusIssues.lackOfDetails.includes(user)) {
        webexClient.sendMessageToPerson(user,
          `${warning} Your current daily status lacks details. **You must make it more descriptive.**`, temporary);
      }

      const status = customStatus;
      if (status) {
        webexClient.sendMessageToPerson(user, `At the moment, your daily status is:\n\n${status}`, temporary);
      } else {
        const notFoundGif = GiphyClient.getRandomGifByTag('not found');
        const msg2 = 'Your daily status is absent.';
        if (notFoundGif) {
          webexClient.sendAttachment({toPersonEmail: user}, notFoundGif, msg2, temporary);
        } else {
          webexClient.sendMessageToPerson(user, msg2, temporary);
        }
      }

      if (status) {
        const usersWithoutStatus = BotCache.get(BotCache.Key.USERS_WITHOUT_STATUS, []);
        if (usersWithoutStatus.includes(user)) {
          webexClient.sendMessageToRoom(MainConfig.operationsRoomId, `Got status from ${user}.`);
          webexClient.sendMessageToRoom(MainConfig.dailyStatusRoomId, `Got status from ${mention(user)}.`);
          const restOfUsersWithoutStatus = without(usersWithoutStatus, [user]);
          BotCache.put(BotCache.Key.USERS_WITHOUT_STATUS, restOfUsersWithoutStatus);
          if (!restOfUsersWithoutStatus.length) {
            BotUtils.sendStatusesReportNoCheck(webexClient);
            BotCache.put(BotCache.Key.STATUSES_COLLECTED, true);
            BotCache.remove(BotCache.Key.USERS_WITHOUT_STATUS);
          }
        }
      }

      let usersInfo = BotCache.get(Key.USERS_INFO);
      if (!usersInfo || !usersInfo.workingToday.includes(user)) {
        usersInfo = Bot_CollectUsersInfo();
        if (!usersInfo.workingToday.includes(user)) {
          debugMessage(user + ' asked status but is not in working list.');
          replyThatUserNotWorking(user, webexClient);
        }
      }
    },
  },
  {
    name: 'Drop status',
    description: `${printCmd('drop status')} - to remove a current daily status`,
    match: matchCmd('drop status'),
    evaluate(commandMessage, webexClient) {
      const user = commandMessage.personEmail;

      webexClient.sendMessageToPerson(user, 'Okay, dropping your daily status...');

      BotCache.remove(BotCache.Key.dailyStatus(user));
      BotCache.put(BotCache.Key.statusDropTime(user), commandMessage.created);

      webexClient.sendMessageToPerson(user, 'Done!');
    },
  },
  {
    name: 'Non acceptable status',
    match(commandText) {
      return commandText.trim().length <= 25 || capitalize(commandText) !== commandText;
    },
    evaluate(commandMessage, webexClient) {
      webexClient.sendMessageToPerson(commandMessage.personEmail,
        `What’s that?  \nYou can try \`help\` or visit ${getHelpPage()} to get more information.`);
    },
  },
  // Should be the last one.
  {
    name: 'Daily Status',
    description: `A custom daily status example:  \n> I was working on the US "#12345: Deployment Optimization". Today, I fixed all the corner cases and started working on the tests.`,
    match(commandText, commandMessage, webexClient: any = null) {
      if (webexClient) {
        const user = commandMessage.personEmail;

        const processedDailyStatus = BotUtils.processDailyStatus(user, commandText.trim(), webexClient);

        if (!processedDailyStatus.statusIsFine) {
          debugMessage(user + ' sent a bad status. Notified.');
          webexClient.sendMessageToPerson(user,
            `${warning} Saved as your daily status, but **you must make it more descriptive.**`);
        } else {
          webexClient.sendMessageToPerson(user, 'Saved as your daily status.');
          BotCache.put(BotCache.Key.dailyStatus(user), processedDailyStatus);

          const usersWithoutStatus = BotCache.get(BotCache.Key.USERS_WITHOUT_STATUS, []);
          if (usersWithoutStatus.includes(user)) {
            webexClient.sendMessageToRoom(MainConfig.operationsRoomId, fmt('Got status from %s.', user));
            webexClient.sendMessageToRoom(MainConfig.dailyStatusRoomId, fmt('Got status from %s.', user));
            const restOfUsersWithoutStatus = without(usersWithoutStatus, [user]);
            if (restOfUsersWithoutStatus.length) {
              BotCache.put(BotCache.Key.USERS_WITHOUT_STATUS, restOfUsersWithoutStatus);
            } else {
              BotUtils.sendStatusesReportNoCheck(webexClient);
              BotCache.put(BotCache.Key.STATUSES_COLLECTED, true);
              BotCache.remove(BotCache.Key.USERS_WITHOUT_STATUS);
            }
          }

          let usersInfo = BotCache.get(Key.USERS_INFO);
          if (!usersInfo || !usersInfo.workingToday.includes(user)) {
            // getting latest to double-check
            usersInfo = Bot_CollectUsersInfo();
            if (!usersInfo.workingToday.includes(user)) {
              debugMessage(user + ' sending a status but is not in working list.');
              replyThatUserNotWorking(user, webexClient);
            }
          }
        }
      }
    },
    evaluate(commandMessage, webexClient) {
    },
  },
];
