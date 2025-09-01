import { useEffect } from 'react';

/**
 * TEMPORARY COMPONENT - Forces cache refresh on mount
 * Remove this after the phantom videoAnalyzer.ts issue is resolved
 */
export function ForceRefresh() {
  useEffect(() => {
    // Check if we have the cache-busting query param
    const urlParams = new URLSearchParams(window.location.search);
    const forcedRefresh = urlParams.get('force-refresh');
    
    if (!forcedRefresh) {
      console.log('🔥 Forcing cache refresh...');
      
      // Clear all caches
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => {
            caches.delete(name);
            console.log(`Deleted cache: ${name}`);
          });
        });
      }
      
      // Unregister service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
            console.log('Service worker unregistered');
          });
        });
      }
      
      // Force reload with cache-busting parameter
      setTimeout(() => {
        window.location.href = window.location.pathname + '?force-refresh=' + Date.now();
      }, 100);
    } else {
      console.log('✅ Page loaded with fresh cache');
      
      // Remove the query param after successful load
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);
  
  return null;
}

// Helper function to manually clear everything
export function nukeCaches() {
  return Promise.all([
    // Clear service worker caches
    caches.keys().then((names) => 
      Promise.all(names.map((name) => caches.delete(name)))
    ),
    // Unregister service workers
    navigator.serviceWorker?.getRegistrations().then((registrations) =>
      Promise.all(registrations.map((reg) => reg.unregister()))
    ),
    // Clear IndexedDB (if any)
    new Promise((resolve) => {
      if ('indexedDB' in window) {
        indexedDB.databases().then((dbs) => {
          dbs.forEach((db) => indexedDB.deleteDatabase(db.name!));
          resolve(true);
        });
      } else {
        resolve(false);
      }
    }),
  ]).then(() => {
    localStorage.clear();
    sessionStorage.clear();
    console.log('🧨 All caches nuked!');
    window.location.reload();
  });
}