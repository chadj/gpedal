import LZString from 'lz-string';

export const managedLocalStorage = {
  'container': (type) => {
    return JSON.parse(localStorage.getItem(type)) || [];
  },
  'unshift': (type, key) => {
    let container = managedLocalStorage.container(type);
    container = container.filter(r => r !== key);
    container.unshift(key);
    localStorage.setItem(type, JSON.stringify(container));
  },
  'remove': (type, key) => {
    let container = managedLocalStorage.container(type);
    container = container.filter(r => r !== key);
    localStorage.removeItem(key);
    localStorage.setItem(type, JSON.stringify(container));
  },
  'add': (type, key, obj) => {
    let container = managedLocalStorage.container(type);

    container.unshift(key);
    if(container.length > 3) {
      let id = container.pop();
      localStorage.removeItem(id);
    }

    localStorage.setItem(type, JSON.stringify(container));
    managedLocalStorage.set(key, obj);
  },
  'set': (key, obj) => {
    let raw = obj;
    if('toJSON' in obj) {
      raw = obj.toJSON();
    }
    localStorage.setItem(key, LZString.compressToUTF16(JSON.stringify(raw)));
  },
  'get': (key) => {
    let raw = localStorage.getItem(key);
    if(raw !== undefined && raw !== null) {
      return JSON.parse(LZString.decompressFromUTF16(raw));
    } else {
      return raw;
    }
  }
};
