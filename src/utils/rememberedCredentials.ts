const DATABASE_NAME = 'pervik-local-credentials';
const DATABASE_VERSION = 1;
const STORE_NAME = 'credentials';
const KEY_RECORD = 'encryption-key';
const PASSWORD_RECORD = 'saved-password';

interface EncryptedPassword {
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Не удалось открыть локальное хранилище'));
    request.onblocked = () => reject(new Error('Локальное хранилище занято'));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Не удалось прочитать локальное хранилище'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Не удалось сохранить данные'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Сохранение отменено'));
  });
}

async function getEncryptionKey(database: IDBDatabase, create: boolean): Promise<CryptoKey | null> {
  const readTransaction = database.transaction(STORE_NAME, 'readonly');
  const readComplete = transactionComplete(readTransaction);
  const existing = await requestValue(readTransaction.objectStore(STORE_NAME).get(KEY_RECORD)) as CryptoKey | undefined;
  await readComplete;
  if (existing) return existing;
  if (!create) return null;

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const writeTransaction = database.transaction(STORE_NAME, 'readwrite');
  writeTransaction.objectStore(STORE_NAME).put(key, KEY_RECORD);
  await transactionComplete(writeTransaction);
  return key;
}

export async function saveRememberedPassword(password: string): Promise<void> {
  if (!password || !globalThis.crypto?.subtle || !globalThis.indexedDB) {
    throw new Error('Зашифрованное хранилище недоступно в этом браузере');
  }

  const database = await openDatabase();
  try {
    const key = await getEncryptionKey(database, true);
    if (!key) throw new Error('Не удалось создать ключ шифрования');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(password));
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ iv: iv.buffer, ciphertext } satisfies EncryptedPassword, PASSWORD_RECORD);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}

export async function loadRememberedPassword(): Promise<string | null> {
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB) return null;

  const database = await openDatabase();
  try {
    const key = await getEncryptionKey(database, false);
    if (!key) return null;
    const readTransaction = database.transaction(STORE_NAME, 'readonly');
    const readComplete = transactionComplete(readTransaction);
    const encrypted = await requestValue(readTransaction.objectStore(STORE_NAME).get(PASSWORD_RECORD)) as EncryptedPassword | undefined;
    await readComplete;
    if (!encrypted) return null;

    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(encrypted.iv) }, key, encrypted.ciphertext);
    return new TextDecoder().decode(plaintext);
  } finally {
    database.close();
  }
}

export async function clearRememberedPassword(): Promise<void> {
  if (!globalThis.indexedDB) return;

  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(PASSWORD_RECORD);
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}
