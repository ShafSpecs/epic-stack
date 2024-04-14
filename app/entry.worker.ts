/// <reference lib="WebWorker" />

import {
  clearUpOldCaches,
	EnhancedCache,
	isDocumentRequest,
	isLoaderRequest,
	Logger,
	NavigationHandler,
  SkipWaitHandler,
	type DefaultFetchHandler,
} from '@remix-pwa/sw'

declare let self: ServiceWorkerGlobalScope

const logger = new Logger({
	prefix: '[Epic Stack]',
})

const version = 'v2'

const DOCUMENT_CACHE_NAME = `document-cache`
const ASSET_CACHE_NAME = `asset-cache`
const DATA_CACHE_NAME = `data-cache`

const documentCache = new EnhancedCache(DOCUMENT_CACHE_NAME, {
	version,
	strategy: 'CacheFirst',
	strategyOptions: {
		maxEntries: 64,
	},
})

const assetCache = new EnhancedCache(ASSET_CACHE_NAME, {
	version,
	strategy: 'CacheFirst',
	strategyOptions: {
		maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days
		maxEntries: 100,
	},
})

const dataCache = new EnhancedCache(DATA_CACHE_NAME, {
	version,
	strategy: 'NetworkFirst',
	strategyOptions: {
		networkTimeoutInSeconds: 10,
		maxEntries: 72,
	},
})

self.addEventListener('install', event => {
	logger.log('Service worker installed')

	event.waitUntil(Promise.all([
    assetCache.preCacheUrls(
      self.__workerManifest.assets.filter(url => !url.endsWith('.map') && !url.endsWith('.js'))
    ),
    // self.skipWaiting(),
  ]))
})

self.addEventListener('activate', event => {
	logger.log('Service worker activated')

	event.waitUntil(Promise.all([
    clearUpOldCaches([DOCUMENT_CACHE_NAME,DATA_CACHE_NAME,ASSET_CACHE_NAME], version),
    self.clients.claim(),
  ]))
})

export const defaultFetchHandler: DefaultFetchHandler = async ({ context }) => {
	const request = context.event.request
	const url = new URL(request.url)

	if (isDocumentRequest(request)) {
		return documentCache.handleRequest(request)
	}

	if (isLoaderRequest(request)) {
		return dataCache.handleRequest(request)
	}

	if (self.__workerManifest.assets.includes(url.pathname)) {
		return assetCache.handleRequest(request)
	}

	return fetch(request)
}

const messageHandler = new NavigationHandler({
  cache: documentCache
})
const skipHandler = new SkipWaitHandler()

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  event.waitUntil(Promise.all([
    messageHandler.handleMessage(event),
    skipHandler.handleMessage(event),
  ]))
})

// self.addEventListener('messageerror', (event: MessageEvent) => {
//   logger.error('Message error', event)
// })