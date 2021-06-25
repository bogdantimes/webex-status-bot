const Reporter = (() => {

  function getTeamStatuses(teamName, statuses) {
    const team = Store.get(Key.TEAMS + '/' + teamName, []);
    const teamStatuses = [];
    team.forEach(user => {
      const userStatus = statuses[user];
      if (userStatus) {
        teamStatuses.push(userStatus);
      }
    });
    return teamStatuses;
  }

  function teamsStatusForEmail(statuses) {
    let teamsStatuses = '';
    const teamNames = Store.get(Key.TeamNames, []);
    if (teamNames.length) {
      teamsStatuses = teamNames.map(teamName => {
        const teamStatuses = getTeamStatuses(teamName, statuses).map(toHtml);
        const style = 'style="font-size:14pt;font-family:Calibri,Helvetica,sans-serif;"';
        return teamStatuses.length ? `<h3><span ${style}>${teamName}</span></h3>${teamStatuses.join('')}` : '';
      }).join('<br/>').trim();
    }
    return teamsStatuses;
  }

  /**
   * Wraps task list inside the daily status into <div><ul><li>...</li></ul></div>.
   * @param statusMarkdown
   * @returns {string}
   */
  function toHtml(statusMarkdown) {
    return `<div style="margin: 20px 0 20px 0">${
      statusMarkdown
        .replace(/\**(\w+ \w\.)\**/, '<b>$1</b>')
        .replace(/\n(.+)/g, '\n<li>$1</li>')
        .replace(/<li>[- *]+/g, '<li>')
        .replace(/(.+)\n/, '$1\n<ul>\n')
        .replace(/(.+)<\/li>$/, '$1<\/li>\n</ul>')
    }</div>`;
  }

  function buildNoStatusBlock(users, reason) {
    return `**${warning} ${reason}**`
      + '\n\n'
      + users.map(user => `${mention(user)} (${user})`).join(', ');
  }

  return {
    sendReportAsEmail(statuses, webexClient) {
      try {
        const teamsStatus = teamsStatusForEmail(statuses);
        if (!teamsStatus) {
          webexClient.sendMessageToRoom(MainConfig.operationsRoomId, 'Failed send a report via email: nothing to send.');
          return;
        }

        const subject = 'Daily status for ' + formatDate(new Date());

        const htmlBody =
          `Hi all,<br/><br/>Here is the team’s status for today.<br/><br/><br/>${teamsStatus}<br/><br/>Thanks,<br/>${MainConfig.botName}`;

        const to = MainConfig.dailyReportTo.join(',');
        const cc = [...MainConfig.managers, ...BotUtils.getTeamLeads()].join(',');

        if (webexClient.DEBUG) {
          webexClient.sendMessageToRoom(MainConfig.debugRoomId, fmt('```html  \n%s  \n```', htmlBody));
        } else {
          const style = 'style="font-size:11pt;font-family:Calibri,Helvetica,sans-serif;"';
          MailApp.sendEmail({to, cc, subject, htmlBody: `<div ${style}>${htmlBody}</div>`});
        }

        webexClient.sendMessageToRoom(MainConfig.operationsRoomId, 'Sent the report via email.');
      } catch (e) {
        debugObject(e);
      }
    },

    sendReportAsChatMessage(dailyStatusesData, usersInfo, webexClient) {
      const inactiveUsers = usersInfo.notWorkingToday;
      const statuses = dailyStatusesData.statuses;
      const usersWithoutStatus = dailyStatusesData.userStatusIssues.noStatus;
      const usersWithLackOfDetails = dailyStatusesData.userStatusIssues.lackOfDetails;
      const usersWithSameStatus = dailyStatusesData.userStatusIssues.sameAsPrevious;
      const teamNames = Store.get(Key.TeamNames, []);

      if (teamNames.length && Object.keys(statuses).length) {
        webexClient.sendMessageToRoom(MainConfig.dailyStatusRoomId, '## Daily status for ' + formatDate(new Date()));

        teamNames.forEach(teamName => {
          const teamStatuses = getTeamStatuses(teamName, statuses);
          if (teamStatuses.length) {
            const separator = '  \n\u200B\n\n';
            webexClient.sendMessageToRoom(MainConfig.dailyStatusRoomId,
              fmt(`\---\n\n### %s${separator}%s\n\n\---`, teamName, teamStatuses.join(separator)));
          }
        });

        const infoBlocks = [];
        if (usersWithoutStatus.length) {
          infoBlocks.push(buildNoStatusBlock(usersWithoutStatus, 'Did not send a status'));
        }
        if (usersWithLackOfDetails.length) {
          infoBlocks.push(buildNoStatusBlock(usersWithLackOfDetails, 'Not enough details'));
        }
        if (usersWithSameStatus.length) {
          infoBlocks.push(buildNoStatusBlock(usersWithSameStatus, 'The status is same as previous'));
        }
        if (inactiveUsers.length) {
          infoBlocks.push('**Did not work today**\n\n' + inactiveUsers.map(inactive => {
            const userFullName = BotUtils.getUserFullName(inactive.user, webexClient);
            return fmt('%s (%s) - %s', userFullName, inactive.user, inactive.reason);
          }).join('  \n'));
        }

        if (infoBlocks.length) {
          webexClient.sendMessageToRoom(MainConfig.dailyStatusRoomId,
            fmt(`\---\n\n%s\n\n\---`, infoBlocks.join('\n\n\---\n\n')));
        }
        this.sendDailyStatusReportGif(usersWithoutStatus.length, webexClient);
      }
    },

    sendDailyStatusReportGif(missedStatusesLength, webexClient) {
      const gifTags = [['greatjob', 'awesome'], ['facepalm'], ['cry']];
      const gifTag = gifTags[missedStatusesLength] || ['cry'];
      try {
        const gif = GiphyClient.getRandomGifByTag(getRandomFromList(gifTag));
        if (gif) {
          webexClient.sendAttachment({roomId: MainConfig.dailyStatusRoomId}, gif);
        }
      } catch (e) {
        console.error('Error sending report gif: ', e);
      }
    },

    notifyHowManyMissed(usersWithoutStatus, all, webexClient) {
      try {
        const missed = usersWithoutStatus.length;
        const noMissed = !missed;
        const statTemplate = noMissed ? 'all' : fmt('%s of %s', all - missed, all);
        webexClient.sendMessageToRoom(MainConfig.operationsRoomId, `Got ${statTemplate} statuses${noMissed ? '' : '\n\n<@all>'}`);
        if (missed) {
          webexClient.sendMessageToRoom(MainConfig.operationsRoomId,
            fmt('Waiting for statuses from: %s.', usersWithoutStatus.join(', ')));
        }
      } catch (e) {
        debugObject(e);
      }
    },

    sendUsersInfoToRoom(usersInfo, roomId, webexClient) {
      const reply = fmt(
        '**Working today:**  \n' + usersInfo.workingToday.join(', ') +
        '  \n**Not working today:**  \n' +
        usersInfo.notWorkingToday.map(elem =>
          fmt('%s (%s)', elem.user, elem.reason)).join('  \n'));

      webexClient.sendMessageToRoom(roomId, reply);
    },

  };
})();
