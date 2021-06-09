function doGet(e) {
  WebHookHandler.handleActionEvent();
  return ContentService.createTextOutput('handled doGet');
}

function doPost(e) {
  WebHookHandler.handleMessageEvent(e.postData.contents);
  return ContentService.createTextOutput('handled doPost');
}

class WebHookHandler {

  static handleMessageEvent(eventData) {
    try {
      const messageData = JSON.parse(eventData).data;
      if (messageData.personEmail !== MainConfig.botEmail) {
        const webexClient = WebexClient();
        const messageFull = webexClient.getMessage(messageData.id);

        if (messageData.roomType === 'group') {
          webexClient.DEBUG = messageFull.roomId === MainConfig.debugRoomId;
          WebHookHandler.handlePublicCommandMessages([messageFull], webexClient);
        } else {
          // console.log('Handled one-to-one message: ', messageFull);
          WebHookHandler.handlePrivateCommandMessage(messageFull, webexClient);
        }
      }
    } catch (e) {
      console.error(e);
      debugMessage('Failed to handle message event');
    }
  }

  static handlePublicCommandMessages(directMessages, webexClient) {
    const publicCommands = PublicCommands();
    directMessages.forEach(message => {
      const user = message.personEmail;

      // rememory bot support
      if (message.text.match(/Rememory remind/)) {
        // ignore when bot is mentioned in a message to Rememory bot
        return;
      }
      if (BotUtils.isBot(user)) {
        let rememoryCommand = message.text.match(/\w+ Reminder: "(.+)" -/);
        if (rememoryCommand) {
          rememoryCommand = rememoryCommand[1];
          debugMessage(`matched Rememory bot command: '${rememoryCommand}'\noriginal: '${message.text}'`);
          message.text = `${MainConfig.botName} ${rememoryCommand}`;
          // TODO: update sender using created by
        }
      }

      try {
        publicCommands.some(command => {
          if (command.match(message.text)) {
            if (command.adminsOnly && !BotUtils.isMessageFromAdmin(user, webexClient)) {
              webexClient.sendMessageToRoom(message.roomId,
                mention(user) + getRandomFromList(Constants.funnyRestrictions));
            } else if (command.workDayOnly && BotUtils.isBot(user) && !isWorkDay(new Date())) {
              // If sent from any bot, do not run workDayOnly commands on weekends/holidays
              webexClient.sendMessageToRoom(message.roomId, `I'm ignoring this reminder because today is a day off.`);
            } else {
              console.log('Evaluating public command', command, message);
              command.evaluate(message, webexClient);
            }
            return true;
          }
        });
      } catch (e) {
        debugMessage(`Failed to handle public command: ${message.text}  \nError: ${e.message}`);
        console.error(e);
        console.error(e.stack);
        webexClient.sendMessageToRoom(message.roomId,
          mention(user) + ', sorry, but something wrong happened. I cannot handle your command: ' + message.text);
      }
    });
  }

  static handlePrivateCommandMessage(message, webexClient) {
    try {
      PrivateCommands().some(command => {
        if (command.match(message.text, message, webexClient)) {
          console.log('Evaluating private command', command, message);
          command.evaluate(message, webexClient);
          return true;
        }
      });
    } catch (e) {
      debugMessage('Failed to handle private command: ' + message.text);
      console.error(e);
      webexClient.sendMessageToPerson(message.personEmail,
        'Sorry, but something wrong happened. I cannot handle your latest message.');
    }
  }

  static handleActionEvent() {

  }
}
