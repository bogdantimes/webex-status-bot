function WebexClient(options?) {
  const DEFAULT_REQUEST_ATTEMPTS = 20;
  const debug = options && options.debug;
  const requestAttempts = options && options.requestAttempts;
  const requestManager = new RequestManager('https://api.ciscospark.com/v1');
  requestManager.setAuthorization('Bearer ' + MainConfig.calmBotAuthToken);
  requestManager.setRequestAttempts(requestAttempts || DEFAULT_REQUEST_ATTEMPTS);
  requestManager.setFetchRetryInterval(1000);

  return {
    DEBUG: debug === undefined ? false : !!debug,
    requestManager: requestManager,

    createWebHook() {
      return this.requestManager.postJson('webhooks', {
        name: 'WebHook',
        targetUrl: MainConfig.webAppHook,
        resource: 'messages',
        event: 'created',
        filter: null,
        secret: null,
      });
    },

    deleteAllWebHooks() {
      const webHooks = this.requestManager.get('webhooks').items;
      // console.log('Webhooks length: ', webHooks.length);
      webHooks.forEach(function (webHook) {
        this.requestManager.remove('webhooks', webHook.id);
        // console.log('Removed webhook ' + webHook.name);
      }, this);
    },

    getMessage(messageId) {
      return this.requestManager.get('messages/' + messageId);
    },

    listOneToOneMessages(personEmail, max) {
      const _max = max || 50;
      let messages = [];
      try {
        messages = this.requestManager.get('messages/direct', {}, {personEmail: personEmail}).items;
      } catch (e) {
        console.error('Failed to get one to one messages for ' + personEmail);
      }
      return messages.slice(0, _max);
    },

    listRoomMembers(roomId) {
      return this.requestManager.get('memberships', {}, {roomId: roomId}).items;
    },

    listTeamMembers(teamId) {
      return this.requestManager.get('team/memberships', {}, {teamId: teamId}).items;
    },

    getUserDetails(email) {
      return BotCache.getOrPut(`getUserDetails_${email}`, () => {
        return this.requestManager.get('people', {}, {email: email}).items[0];
      }, SEC_IN_ONE_HOUR);
    },

    sendMessage(to, markdown, temporary?: boolean) {
      to = this.DEBUG ? {roomId: MainConfig.debugRoomId} : to;
      // console.log(markdown, to);
      const payload = Object.assign({}, to, {markdown: markdown});
      const result = this.requestManager.postJson('messages', payload);
      if (temporary) {
        this._saveMessageMeta(result.id, temporary, to);
      }
      return result;
    },

    sendAttachment(to, files, markdown, temporary?: boolean) {
      to = this.DEBUG ? {roomId: MainConfig.debugRoomId} : to;
      const payload = Object.assign({}, to, {files: files, markdown: markdown});
      // console.log(markdown, to, files);
      const result = this.requestManager.post('messages', {payload: payload});
      if (temporary) {
        this._saveMessageMeta(result.id, temporary, to);
      }
      return result;
    },

    sendMessageToPerson(personEmail, markdown, temporary?: boolean) {
      return this.sendMessage({toPersonEmail: personEmail}, markdown, temporary);
    },

    sendMessageToPersonNoSwitch(personEmail, markdown, temporary?: boolean) {
      return this.sendMessage({toPersonEmail: personEmail}, markdown, temporary);
    },

    sendMessageToRoom(roomId, markdown, temporary?: boolean) {
      return this.sendMessage({roomId: roomId}, markdown, temporary);
    },

    sendDebugMessage(text) {
      return this.sendMessage({roomId: MainConfig.debugRoomId}, text);
    },

    addPersonToRoom(personEmail, roomId, isModerator) {
      return this.requestManager.postJson('memberships', {personEmail, roomId, isModerator});
    },

    deleteMessage(id) {
      try {
        this.requestManager.remove('messages', id);
      } catch (e) {
        debugMessage('Failed to delete teams message with id: ' + id);
        console.error(e);
      } finally {
        this._removeMessageMeta(id);
      }
    },

    deleteTemporaryMessages(msgReceiver) {
      Store.get(Key.TEMP_MESSAGES, []).forEach(function (message) {
        if (message.temporary && msgReceiver === message.receiver) {
          this.deleteMessage(message.id);
        }
      }, this);
    },

    _removeMessageMeta(id) {
      const tempMessages = Store.get(Key.TEMP_MESSAGES, []);
      const resultTempMessages = tempMessages.filter(message => message.id !== id);
      Store.set(Key.TEMP_MESSAGES, resultTempMessages);
    },

    _saveMessageMeta(id, temporary, to) {
      const tempMessages = Store.get(Key.TEMP_MESSAGES, []);
      tempMessages.push({id: id, temporary: temporary, receiver: to.toPersonEmail || to.roomId});
      Store.set(Key.TEMP_MESSAGES, tempMessages);
    },
  };
}
