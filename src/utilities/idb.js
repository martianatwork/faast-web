import pkg from 'Pkg'
import { dateNowString, downloadJson } from './helpers'
import idbWrapper from 'idb-wrapper'

const DAYS_TO_STORE = 14
const stores = {}

/** Polyfill idb-wrapper for react-static */
const IDBStore = typeof window !== 'undefined'
  ? idbWrapper
  : function () {
    return {
      put: (data, cb) => cb(''),
      getAll: (cb) => cb([]),
      remove: (key, cb) => cb(null),
    }
  }

const setup = (storeNames) => {
  return Promise.all(
    storeNames.map((storeName) => new Promise((resolve) => {
      if (!stores[storeName]) {
        stores[storeName] = {}
      }
      stores[storeName].store = new IDBStore({
        dbVersion: 1,
        storeName,
        keyPath: 'id',
        autoIncrement: true,
        onStoreReady: () => {
          stores[storeName].ready = true
          resolve()
        }
      })
    }))
  )
}

const put = (storeName, data) => {
  return new Promise((resolve, reject) => {
    if (!stores[storeName] || !stores[storeName].ready) return reject(new Error('store not ready'))

    stores[storeName].store.put(data, (id) => {
      resolve(id)
    }, (error) => {
      reject(error)
    })
  })
}

const getAll = (storeName) => {
  return new Promise((resolve, reject) => {
    if (!stores[storeName] || !stores[storeName].ready) return reject(new Error('store not ready'))

    stores[storeName].store.getAll((idbtx) => {
      resolve(idbtx)
    }, (error) => {
      reject(error)
    })
  })
}

const remove = (storeName, key) => {
  return new Promise((resolve, reject) => {
    if (!stores[storeName] || !stores[storeName].ready) return reject(new Error('store not ready'))

    stores[storeName].store.remove(key, () => {
      resolve()
    }, (error) => {
      reject(error)
    })
  })
}

const removeOld = (storeName) => {
  return new Promise((resolve, reject) => {
    if (!stores[storeName] || !stores[storeName].ready) return reject(new Error('store not ready'))

    getAll(storeName)
      .then((result) => {
        const day = 1000 * 60 * 60 * 24
        const date = new Date()
        const minTime = date.getTime() - (day * DAYS_TO_STORE)
        const tooOld = result.map((r) => {
          if (r.id && typeof r.id === 'number' && r.id < minTime) return r.id
        }).filter(a => a)
        Promise.all(tooOld.map(key => remove(storeName, key)))
          .then(resolve)
          .catch(reject)
      })
      .catch(reject)
  })
}

const exportDb = (storeName) => {
  return new Promise((resolve, reject) => {
    if (!stores[storeName] || !stores[storeName].ready) return reject(new Error('store not ready'))

    getAll(storeName)
      .then((result) => {
        return downloadJson({
          [storeName]: result
        }, `${pkg.name}-${storeName}-${dateNowString('_', '-')}`)
      })
      .then((jsonString) => {
        resolve(jsonString)
      })
      .catch((e) => {
        reject(e)
      })
  })
}

export default {
  setup,
  put,
  exportDb,
  removeOld
}
