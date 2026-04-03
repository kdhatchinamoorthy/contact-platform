// ================================================
// db.js — IndexedDB wrapper for ContactHub
// ================================================
const DB_NAME = 'contacthub_db';
const DB_VER  = 3;
let db = null;

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('users')) {
        const us = d.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
        us.createIndex('email', 'email', { unique: true });
      }
      if (!d.objectStoreNames.contains('contacts')) {
        const cs = d.createObjectStore('contacts', { keyPath: 'id', autoIncrement: true });
        cs.createIndex('userId', 'userId', { unique: false });
      }
      if (!d.objectStoreNames.contains('messages')) {
        const ms = d.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
        ms.createIndex('contactId', 'contactId', { unique: false });
        ms.createIndex('userId', 'userId', { unique: false });
      }
      if (!d.objectStoreNames.contains('reminders')) {
        const rs = d.createObjectStore('reminders', { keyPath: 'id', autoIncrement: true });
        rs.createIndex('userId', 'userId', { unique: false });
      }
      if (!d.objectStoreNames.contains('activity')) {
        const as = d.createObjectStore('activity', { keyPath: 'id', autoIncrement: true });
        as.createIndex('userId', 'userId', { unique: false });
      }
    };
    req.onsuccess = e => { db = e.target.result; res(db); };
    req.onerror   = e => rej(e.target.error);
  });
}

function dbAll(store, index, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const st = tx.objectStore(store);
    const req = index ? st.index(index).getAll(key) : st.getAll();
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

function dbGet(store, id) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

function dbAdd(store, data) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).add(data);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

function dbPut(store, data) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(data);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

function dbDelete(store, id) {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

function dbByIndex(store, index, key) {
  return dbAll(store, index, key);
}

function dbGetByEmail(email) {
  return new Promise((res, rej) => {
    const tx = db.transaction('users', 'readonly');
    const req = tx.objectStore('users').index('email').get(email);
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
