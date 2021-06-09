class GiphyClient {
  static getRandomGifByTag(tag) {
    const requestManager = new RequestManager('https://api.giphy.com/v1');
    const response = requestManager.get('gifs/random', {}, {
      api_key: 'MfijDCibbkBBHbyBpAc6N6VmP7enQMAZ',
      rating: 'PG',
      tag: tag
    });
    if (response.data.images) {
      return UrlFetchApp.fetch(response.data.images.fixed_height.url).getBlob();
    }
    return null;
  }
}
