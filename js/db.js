const db = {
  dbName: 'FinanceTrackerDB',
  dbVersion: 1,
  db: null,

  init: () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(db.dbName, db.dbVersion);

      request.onerror = (event) => {
        console.error('Database error:', event.target.error);
        reject('Database error: ' + event.target.errorCode);
      };

      request.onupgradeneeded = (event) => {
        const dbInstance = event.target.result;
        if (!dbInstance.objectStoreNames.contains('transactions')) {
          const objectStore = dbInstance.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
          objectStore.createIndex('date', 'date', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        db.db = event.target.result;
        resolve();
      };
    });
  },

  addTransaction: (transaction) => {
    return new Promise((resolve, reject) => {
      const trans = db.db.transaction(['transactions'], 'readwrite');
      const store = trans.objectStore('transactions');
      const request = store.add(transaction);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        console.error('Error adding transaction:', event.target.error);
        reject('Error adding transaction: ' + event.target.errorCode);
      };
    });
  },

  getTransactions: () => {
    return new Promise((resolve, reject) => {
      const trans = db.db.transaction(['transactions'], 'readonly');
      const store = trans.objectStore('transactions');
      const request = store.getAll();

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error('Error getting transactions:', event.target.error);
        reject('Error getting transactions: ' + event.target.errorCode);
      };
    });
  },

  deleteTransaction: (id) => {
    return new Promise((resolve, reject) => {
        const trans = db.db.transaction(['transactions'], 'readwrite');
        const store = trans.objectStore('transactions');
        const request = store.delete(id);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = (event) => {
            console.error('Error deleting transaction:', event.target.error);
            reject('Error deleting transaction: ' + event.target.errorCode);
        };
    });
  }
};
