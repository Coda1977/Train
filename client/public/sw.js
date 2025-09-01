const CACHE_NAME = 'drillmaster-v2';
const STATIC_CACHE = 'drillmaster-static-v2';
const VIDEO_CACHE = 'drillmaster-videos-v2';

const urlsToCache = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch event - handle different types of requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle video files differently
  if (request.url.includes('/objects/') || request.headers.get('accept')?.includes('video')) {
    event.respondWith(handleVideoRequest(request));
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request));
    return;
  }

  // Handle static assets and app shell
  event.respondWith(handleStaticRequest(request));
});

// Handle video requests with specific caching strategy
async function handleVideoRequest(request) {
  const cache = await caches.open(VIDEO_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.status === 200) {
      // Cache successful video responses
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return offline fallback for videos
    return new Response('Video unavailable offline', { 
      status: 503,
      statusText: 'Service Unavailable' 
    });
  }
}

// Handle API requests with network-first strategy
async function handleAPIRequest(request) {
  try {
    const response = await fetch(request);
    
    // Cache GET requests for offline access
    if (request.method === 'GET' && response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Try to return cached response for GET requests
    if (request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    // Return offline response
    return new Response(JSON.stringify({
      error: 'Offline - this feature requires an internet connection'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle static requests with cache-first strategy
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return app shell for navigation requests
    if (request.mode === 'navigate') {
      return cache.match('/');
    }
    throw error;
  }
}

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const expectedCaches = [CACHE_NAME, STATIC_CACHE, VIDEO_CACHE];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!expectedCaches.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      self.clients.claim();
    })
  );
});

// Background sync for uploading videos when online
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-upload') {
    event.waitUntil(handleBackgroundUpload());
  }
});

async function handleBackgroundUpload() {
  // Handle queued video uploads when connection is restored
  try {
    const pendingUploads = await getStoredUploads();
    for (const upload of pendingUploads) {
      await processUpload(upload);
    }
    await clearStoredUploads();
  } catch (error) {
    console.error('Background upload failed:', error);
  }
}

async function getStoredUploads() {
  // Retrieve pending uploads from IndexedDB
  return [];
}

async function processUpload(upload) {
  // Process a queued upload
  return fetch('/api/drills', {
    method: 'POST',
    body: JSON.stringify(upload),
    headers: { 'Content-Type': 'application/json' }
  });
}

async function clearStoredUploads() {
  // Clear processed uploads from storage
}
