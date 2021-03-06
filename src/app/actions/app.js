import qs from 'query-string'

import { newScopedCreateAction } from 'Utilities/action'
import { localStorageGetJson, sessionStorageSet } from 'Utilities/storage'
import blockstack from 'Utilities/blockstack'
import { filterUrl } from 'Utilities/helpers'
import log from 'Utilities/log'
import { restoreCachedAffiliateInfo } from 'Actions/affiliate'

import { retrieveAssets, restoreAssets } from './asset'
import { setSettings } from './settings'
import { restoreAllPortfolios, updateAllHoldings } from './portfolio'
import { restoreTxs } from './tx'
import { retrieveAllSwaps, restoreSwapTxIds, restoreSwapPolling } from './swap'
import { fetchGeoRestrictions } from 'Common/actions/app'

export * from 'Common/actions/app'

const createAction = newScopedCreateAction(__filename)

export const appReady = createAction('READY')
export const appError = createAction('ERROR')
export const resetAll = createAction('RESET_ALL')

export const restoreState = (dispatch) => Promise.resolve()
  .then(() => {
    dispatch(restoreCachedAffiliateInfo())
    const assetCache = localStorageGetJson('state:asset')
    if (assetCache) {
      dispatch(restoreAssets(assetCache))
      dispatch(retrieveAssets()) // Retrieve updated assets in background
    } else {
      return dispatch(retrieveAssets()) // asset list required to restore wallets
    }
  })
  .then(() => dispatch(restoreAllPortfolios()))
  .then(() => {
    dispatch(updateAllHoldings())
    const txState = localStorageGetJson('state:tx')
    if (txState) {
      dispatch(restoreTxs(txState))
    }
    return dispatch(retrieveAllSwaps())
  })
  .then((retrievedSwaps) => {
    const swapTxIds = localStorageGetJson('state:swap-txId')
    if (swapTxIds) {
      dispatch(restoreSwapTxIds(swapTxIds))
    }
    retrievedSwaps.forEach(({ orderId }) => dispatch(restoreSwapPolling(orderId)))
  })
  .catch((e) => {
    log.error(e)
    throw new Error('Error loading app: ' + e.message)
  })

export const setupBlockstack = (dispatch) => Promise.resolve()
  .then(() => {
    if (blockstack.isSignInPending()) {
      log.info('blockstack signin pending')
      return blockstack.handlePendingSignIn()
        .then(() => window.location.replace(filterUrl()))
    }
  })
  .then(() => {
    if (blockstack.isUserSignedIn()) {
      return blockstack.getSettings()
        .then((settings) => dispatch(setSettings(settings)))
    }
  })
  .catch((e) => {
    log.error('Failed to setup Blockstack', e)
  })

export const setupAffiliateReferral = () => Promise.resolve()
  .then(() => {
    const query = qs.parse(window.location.search, { ignoreQueryPrefix: true })
    if (typeof query.aid === 'string') {
      sessionStorageSet('affiliateId', query.aid)
    } else if (typeof query.ref === 'string' && query.ref !== 'producthunt') {
      sessionStorageSet('affiliateId', query.ref)
    }
  })
  .catch((e) => {
    log.error('Failed to setup affiliate referral', e)
  })

export const init = () => (dispatch) => Promise.resolve()
  .then(() => dispatch(fetchGeoRestrictions()))
  .then(() => dispatch(restoreState))
  .then(() => dispatch(setupBlockstack))
  .then(() => dispatch(appReady()))
  .then(() => setupAffiliateReferral())
  .catch((e) => {
    log.error(e)
    const message = e.message || 'Unknown error'
    dispatch(appError(message))
  })
