const PublicCommands = () => {
  function printTeam(teams?) {
    teams = teams || Store.get(Key.TEAMS, {});

    return teamName => {
      const members = teams[teamName].map(member =>
        member === teams[teamName][0] ? member + ' [Team-lead]' : member).join('  \n');
      return `**${teamName}**  \n${members}`;
    };
  }

  return [
    {
      name: 'Restart',
      adminsOnly: true,
      match: commandText => commandText.match(/^\w+[,]? \/restart/i),
      evaluate(commandMessage, webexClient) {
        const match = this.match(commandMessage.text);
        if (match) {
          BotUtils.sendDefaultCommandHandledReply(this.name, commandMessage, webexClient);
          Bot_Restart();
          BotUtils.sendDefaultCommandDoneReply(commandMessage, webexClient);
        }
      },
    },
    {
      name: 'Help',
      hidden: true,
      description: `@${MainConfig.botName} **help**`,
      match: commandText => commandText.match(/^\w+[,]? help/i),
      evaluate(commandMessage, webexClient) {
        const match = this.match(commandMessage.text);
        if (match) {
          const user = commandMessage.personEmail;
          const commands = PublicCommands()
            .filter(command => !command.hidden &&
              (command.adminsOnly ? BotUtils.isMessageFromAdmin(user, webexClient) : true))
            .map(command => command.description).join('  \n');
          webexClient.sendMessageToRoom(commandMessage.roomId, mention(user) + ', here’s what you can use:  \n' + commands);
          webexClient.sendMessageToRoom(commandMessage.roomId,
            fmt('If you need any additional information, please visit %s.\n\n' +
              'The help content is in development, so any contribution will be very appreciated.  \n' +
              'You can leave your comments there.', getHelpPage()));
        }
      },
    },
    {
      name: 'Show config',
      adminsOnly: true,
      description: `@${MainConfig.botName} **show config**`,
      match: commandText => commandText.match(/^\w+[,]? show config/i),
      evaluate(commandMessage, webexClient) {
        const match = this.match(commandMessage.text);
        if (match) {
          webexClient.sendMessageToRoom(commandMessage.roomId,
            mention(commandMessage.personEmail) + ', here:  \n' + printObject(MainConfig.get()));
        }
      },
    },
    {
      name: 'Init Debug Room',
      adminsOnly: true,
      description: `@${MainConfig.botName} **init debug room**`,
      match: commandText => commandText.match(/^\w+[,]? init debug room/i),
      evaluate(commandMessage, webexClient) {
        const config = MainConfig.get();
        config.debugRoomId = commandMessage.roomId
        Store.set(Key.CONFIG, config)
        BotUtils.sendDefaultCommandDoneReply(commandMessage, webexClient)
      },
    },
    {
      name: 'Init Daily Status Room',
      adminsOnly: true,
      description: `@${MainConfig.botName} **init daily statuses room**`,
      match: commandText => commandText.match(/^\w+[,]? init status room/i),
      evaluate(commandMessage, webexClient) {
        const config = MainConfig.get();
        config.dailyStatusRoomId = commandMessage.roomId
        Store.set(Key.CONFIG, config)
        BotUtils.sendDefaultCommandDoneReply(commandMessage, webexClient)
      },
    },
    {
      name: 'Init Operations Room',
      adminsOnly: true,
      description: `@${MainConfig.botName} **init operations room**`,
      match: commandText => commandText.match(/^\w+[,]? init operations room/i),
      evaluate(commandMessage, webexClient) {
        const config = MainConfig.get();
        config.operationsRoomId = commandMessage.roomId
        Store.set(Key.CONFIG, config)
        BotUtils.sendDefaultCommandDoneReply(commandMessage, webexClient)
      },
    },
    {
      name: 'Its Our Chat',
      hidden: true,
      adminsOnly: true,
      description: `@${MainConfig.botName} **its our chat**`,
      match: commandText => commandText.match(/^\w+[,]? its our chat/i),
      evaluate(commandMessage, webexClient) {
        const user = commandMessage.personEmail;
        const teamName = BotUtils.getTeamName(user);
        if (teamName) {
          const team = Store.get(Key.TEAMS + '/' + teamName, []);
          const commandFromTeamLead = team[0] === user;
          if (commandFromTeamLead) {
            Store.set(Key.TEAM_CHAT + '/' + teamName, commandMessage.roomId);
            webexClient.sendMessageToRoom(commandMessage.roomId,
              fmt('%s, ok. I’ll post notifications related to the **%s** team here.', mention(user), teamName));
          } else {
            webexClient.sendMessageToRoom(commandMessage.roomId,
              mention(user) + ', only a team lead can set a team chat.');
          }
        } else {
          webexClient.sendMessageToRoom(commandMessage.roomId,
            mention(user) + ', I cannot find a team to which you belong.');
        }
      },
    },
    {
      name: 'Set Team',
      adminsOnly: true,
      description: `@${MainConfig.botName} **set team DreamTeam1 user1@email.com user2@email.com...** - creates/updates a team.`,
      match: commandText => commandText.match(/^\w+[,]? set team ([\w-]+)\s+((?:.|\s)+)*/i),
      parseListedUsers(input) {
        const separator = '&';
        return input.trim().replace(/\s+/g, separator).split(separator);
      },
      evaluate(commandMessage, webexClient) {
        const match = this.match(commandMessage.text);
        if (match) {
          if (match[2]) {
            BotUtils.sendFastCommandReply(commandMessage, webexClient);
            const listedUsers = this.parseListedUsers(match[2]);
            const groupedUsers = BotUtils.groupDailyStatusUsersByListedUsers(listedUsers, webexClient);
            const unknownUsers = groupedUsers.unknownUsers;
            const knownUsers = groupedUsers.knownUsers;

            if (unknownUsers.length) {
              let failedToAdd = [];
              unknownUsers.forEach(user => {
                try {
                  webexClient.addPersonToRoom(user, MainConfig.dailyStatusRoomId, false);
                  debugMessage(`Added ${user} to Daily Status room`);
                  knownUsers.push(user);
                } catch (e) {
                  debugMessage(`Failed to add ${user} to Daily Status room`);
                  failedToAdd.push(user);
                }
              });
              if (failedToAdd.length) {
                webexClient.sendMessageToRoom(commandMessage.roomId,
                  fmt(`%s, these users are not in the Daily Status room: %s.  \nPlease, invite them and try again.`,
                    mention(commandMessage.personEmail), failedToAdd.join(', ')));
              }
            }

            if (knownUsers.length) {
              const teamName = match[1];
              Store.set(Key.TEAMS + '/' + teamName, knownUsers);
              const teamNames = Store.get(Key.TeamNames, []);
              if (!teamNames.includes(teamName)) {
                Store.set(Key.TeamNames, teamNames.concat([teamName]));
              }
              BotUtils.sendDefaultCommandDoneReply(commandMessage, webexClient);
            }
          } else {
            webexClient.sendMessageToRoom(commandMessage.roomId,
              mention(commandMessage.personEmail) + ', I didn\'t get it. You have to provide user emails after the team name.');
          }
        }
      },
    },
    {
      name: 'Show Teams',
      description: `@${MainConfig.botName} **show teams** - shows all teams with members.`,
      match: commandText => commandText.match(/^\w+[,]? show teams/i),
      evaluate(commandMessage, webexClient) {
        const match = this.match(commandMessage.text);
        if (match) {
          const teams = Store.get(Key.TEAMS, {});
          const teamNames = Store.get(Key.TeamNames, []);
          if (teamNames.length) {
            const reply = fmt('%s, here:\n\n%s',
              mention(commandMessage.personEmail),
              teamNames.map(printTeam(teams)).join('\n\n'),
            );
            webexClient.sendMessageToRoom(commandMessage.roomId, reply);
          } else {
            webexClient.sendMessageToRoom(commandMessage.roomId,
              mention(commandMessage.personEmail) + ', there are no teams added yet. Try to add using `set team` command.');
          }
        }
      },
    },
    {
      name: 'Remove Team',
      adminsOnly: true,
      description: `@${MainConfig.botName} **remove team DreamTeam1** - removes the team.`,
      match: commandText => commandText.match(/^\w+[,]? remove team (\w+)/i),
      evaluate(commandMessage, webexClient) {
        const match = this.match(commandMessage.text);
        if (match) {
          const teamName = match[1];
          const teamNames = Store.get(Key.TeamNames, []);
          if (teamNames.includes(teamName)) {
            Store.set(Key.TeamNames, without(teamNames, [teamName]));
            Store.remove(`${Key.TEAMS}/${teamName}`);
            BotUtils.sendDefaultCommandDoneReply(commandMessage, webexClient);
          } else {
            webexClient.sendMessageToRoom(commandMessage.roomId, fmt('%s, there is no such team as **%s**.',
              mention(commandMessage.personEmail), teamName));
          }
        }
      },
    },
    {
      name: 'Check Statuses',
      adminsOnly: true,
      description: `@${MainConfig.botName} **check statuses** - collects statuses, sends the summary to the Daily Status room and via email.`,
      match: commandText => commandText.match(/^\w+[,]? check statuses/i),
      evaluate(commandMessage, webexClient) {
        const match = this.match(commandMessage.text);
        if (match) {
          if (BotCache.get(BotCache.Key.STATUSES_COLLECTED)) {
            webexClient.sendMessageToRoom(commandMessage.roomId,
              mention(commandMessage.personEmail) + ', all statuses already collected.  \n' +
              'Please, use **send report** command to silently re-collect again for a final email.');
            return;
          }
          BotUtils.sendDefaultCommandHandledReply(this.name, commandMessage, webexClient);
          Bot_CheckStatuses({manualCall: true});
          BotUtils.sendDefaultCommandDoneReply(commandMessage, webexClient);
        }
      },
    },
    {
      name: 'Send Report Mail',
      adminsOnly: true,
      description: `@${MainConfig.botName} **send email** - compiles daily statuses into an email and sends it to leads/managers.`,
      match: commandText => commandText.match(/^\w+[,]? send (report|email)/i),
      evaluate(commandMessage, webexClient) {
        const match = this.match(commandMessage.text);
        if (match) {
          BotUtils.sendDefaultCommandHandledReply(this.name, commandMessage, webexClient);

          const usersInfo = Bot_CollectUsersInfo();
          const dailyStatusesData = BotUtils.collectDailyStatusesData(usersInfo.workingToday, webexClient);
          const statuses = dailyStatusesData.statuses;
          const usersWithoutStatus = dailyStatusesData.userStatusIssues.noStatus;

          if (usersWithoutStatus.length) {
            const reply2 = fmt('%s, I’ll send a report, but there are still users without a status: %s',
              mention(commandMessage.personEmail), usersWithoutStatus.join(', '));
            webexClient.sendMessageToRoom(commandMessage.roomId, reply2);
            Reporter.sendReportAsEmail(statuses, webexClient);
          } else {
            Reporter.sendReportAsEmail(statuses, webexClient);
          }

          BotUtils.sendDefaultCommandDoneReply(commandMessage, webexClient);
        }
      },
    },
    {
      name: 'Show Holidays',
      description: `@${MainConfig.botName} **show holidays** - shows configured holidays.`,
      match: commandText => commandText.match(/^\w+[,]? show holidays/i),
      evaluate(commandMessage, webexClient) {
        const match = this.match(commandMessage.text);
        if (match) {
          const holidays = Store.get(Key.HOLIDAYS, []).join('  \n');
          webexClient.sendMessageToRoom(commandMessage.roomId,
            mention(commandMessage.personEmail) + ', here:  \n' + holidays);
        }
      },
    },
    {
      name: 'User of the day',
      description: `@${MainConfig.botName} **who's ...** - randomly peeks someone.`,
      match: commandText => commandText.match(/^\w+[,]? who['’]s (.+[^?])/i),
      evaluate(commandMessage, webexClient) {
        const match = this.match(commandMessage.text);
        if (match) {
          const users = BotUtils.listUsers(commandMessage.roomId, webexClient);
          users.push(MainConfig.botEmail);
          const user = getRandomFromList(users);

          const message = '🎲 ' + (commandMessage.text.includes('of the day') ?
            `${mention(user)} is **“${match[1]}”** of the day. Congrats!` :
            `${mention(user)} is ${match[1]}. Congrats!`);

          webexClient.sendMessageToRoom(commandMessage.roomId, message);
        }
      },
    },
    {
      name: 'Shuffle team-members',
      workDayOnly: true,
      description: `@${MainConfig.botName} **shuffle** - returns team-members in random order.`,
      match: commandText => commandText.match(/^\w+[,]? shuffle/i),
      evaluate(commandMessage, webexClient) {
        const match = this.match(commandMessage.text);
        if (match) {
          const teamName = BotUtils.getTeamNameByRoom(commandMessage.roomId);
          let members;
          if (teamName) {
            members = Store.get(Key.TEAMS + '/' + teamName, {});
          } else {
            members = BotUtils.listUsers(commandMessage.roomId, webexClient);
          }
          const usersInfo = BotCache.get(Key.USERS_INFO) || Bot_CollectUsersInfo();
          const excluded = usersInfo.notWorkingToday.map(u => u.user);
          const shuffledMembers = shuffle(without(members, excluded));

          const message = '👑 ' + (shuffledMembers.map(mention).join('  \n🎲 '));

          const notAvailable = usersInfo.notWorkingToday.reduce((s, el) => members.find(m => m === el.user) ?
            s + `  \n${BotUtils.getUserFullName(el.user, webexClient)} (${el.reason})` : s, '');

          webexClient.sendMessageToRoom(commandMessage.roomId, notAvailable ? `${message}\n\n[N/A]${notAvailable}` : message);
        }
      },
    },
    {
      name: 'Quick reply',
      hidden: true,
      description: `@${MainConfig.botName} ...`,
      match: commandText => commandText.match(/^\w+[,]?/i),
      evaluate(commandMessage, webexClient) {
        const match = this.match(commandMessage.text);
        if (match) {
          const answer = mention(commandMessage.personEmail) + getRandomFromList(Constants.quickReplies);
          webexClient.sendMessageToRoom(commandMessage.roomId, answer);
        }
      },
    },
  ];
};
