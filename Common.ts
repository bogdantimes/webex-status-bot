const SEC_IN_ONE_HOUR = 3600;

function fmt(template: string, ...args: any[]) {
  return Utilities.formatString(template, ...args);
}

function getUuid() {
  return Utilities.getUuid();
}

function capitalize(string) {
  return string[0].toUpperCase() + string.slice(1);
}

function getRandomFromList(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Shuffles array in place. ES6 version
 * @param {Array} a items An array containing the items.
 */
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function prependZero(num) {
  return num < 10 ? '0' + num : num;
}

/**
 * Converts date object into yyyy/mm/dd format
 */
function formatDate(date) {
  if (!date) return date;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  return date.getFullYear() + '/' + prependZero(month) + '/' + prependZero(day);
}

function dateCode(date = null) {
  date = date || new Date();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${date.getFullYear()}${prependZero(month)}${prependZero(day)}`;
}

function without(list, rejectList) {
  return list.filter(item => !rejectList.includes(item));
}

function unique(list) {
  return Object.keys(list.reduce((map, i) => map[i] = 1 && map, {}));
}

interface ExecParams {
  context: any;
  runnable: (any) => any;
  interval?: number;
  attempts?: number;
}

function execute({context, runnable, interval = 2000, attempts = 5}: ExecParams) {
  let errorMessage = '';
  do {
    try {
      return runnable(context);
    } catch (e) {
      errorMessage = e.message;
      if (errorMessage.includes('INTERRUPT')) {
        break;
      }
    }
    if (attempts > 0) {
      Utilities.sleep(interval)
    }
  } while (--attempts > 0);

  debugMessage('All attempts failed. Error message: ' + errorMessage);
  throw Error(errorMessage);
}

function appendMissingDot(s) {
  return s.replace(/[,. ]*$/, '.');
}

function getFirstLetters(text) {
  const split = text.split(/\s+/);
  return split.reduce((s, el) => s + el[0], '').toLowerCase();
}
