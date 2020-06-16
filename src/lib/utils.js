import {credentials} from "./oauth";

export function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function fileRead(file) {
  return new Promise(function(resolve,reject) {
    let reader = new FileReader();
    reader.onload = e => {
      resolve(e.target.result);
    };
    reader.onerror = e => {
      reject(e.target.error);
    };
    reader.readAsText(file, "UTF-8");
  });
}

export function readCharacteristicValue(characteristic) {
  return new Promise(function(resolve,reject) {
    let executed = false;
    let listener = event => {
      characteristic.removeEventListener('characteristicvaluechanged', listener);
      characteristic.stopNotifications();
      if(!executed) {
        executed = true;
        resolve(event.target.value);
      }
    }

    characteristic.addEventListener('characteristicvaluechanged', listener);
    characteristic.startNotifications();
  });
}

export function dateFormat(dt) {
  let month = dt.getUTCMonth() + 1;
  month = (month < 10) ? "0" + month : month;

  let day = dt.getUTCDate();
  day = (day < 10) ? "0" + day : day;

  let hours = dt.getUTCHours();
  hours = (hours < 10) ? "0" + hours : hours;

  let minutes = dt.getUTCMinutes();
  minutes = (minutes < 10) ? "0" + minutes : minutes;

  let seconds = dt.getUTCSeconds();
  seconds = (seconds < 10) ? "0" + seconds : seconds;

  return dt.getUTCFullYear() + "-" + month + "-" + day + "T" + hours + ":" + minutes + ":" + seconds + "Z";
}

export function hasStravaOauthTokens() {
    let oauthJson = localStorage.getItem('strava-oauth' + credentials.STRAVA_CLIENT_ID);
    let retval = false;
    if(oauthJson !== null && oauthJson !== undefined && oauthJson !== '' && oauthJson !== 'undefined' && oauthJson !== 'null') {
        let oauth = JSON.parse(oauthJson);
        if(oauth.access_token && oauth.refresh_token) {
            retval = true;
        }
    }

    return retval;
}

export function getStravaOauthTokens() {
    let oauthJson = localStorage.getItem('strava-oauth' + credentials.STRAVA_CLIENT_ID);
    let oauth;
    if(oauthJson !== null && oauthJson !== undefined && oauthJson !== '' && oauthJson !== 'undefined' && oauthJson !== 'null') {
        oauth = JSON.parse(oauthJson);
    } else {
        oauth = {};
    }

    return oauth;
}

export function setStravaOauthTokens(oauth) {
    localStorage.setItem('strava-oauth' + credentials.STRAVA_CLIENT_ID, JSON.stringify(oauth));
}

export function removeStravaOauthTokens() {
    localStorage.removeItem('strava-oauth' + credentials.STRAVA_CLIENT_ID);
}
