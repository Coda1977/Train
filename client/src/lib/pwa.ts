// PWA Service Worker Registration and Management

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

class PWAManager {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstalled = false;

  constructor() {
    this.init();
  }

  private async init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        
        console.log('ServiceWorker registered successfully:', registration);
        
        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content available
                this.showUpdateAvailable();
              }
            });
          }
        });

      } catch (error) {
        console.log('ServiceWorker registration failed:', error);
      }
    }

    // Handle install prompt
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.showInstallButton();
    });

    // Handle successful install
    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.hideInstallButton();
      console.log('PWA was installed');
    });

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
    }
  }

  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    await this.deferredPrompt.prompt();
    const choice = await this.deferredPrompt.userChoice;
    
    this.deferredPrompt = null;
    
    return choice.outcome === 'accepted';
  }

  private showInstallButton() {
    // Create install button if it doesn't exist
    if (!document.getElementById('pwa-install-btn')) {
      const button = document.createElement('button');
      button.id = 'pwa-install-btn';
      button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Install App
      `;
      button.className = `
        fixed bottom-4 right-4 z-50 bg-primary text-primary-foreground 
        px-4 py-2 rounded-full shadow-lg flex items-center gap-2 
        text-sm font-medium hover:bg-primary/90 transition-colors
        animate-bounce
      `;
      
      button.addEventListener('click', async () => {
        const installed = await this.promptInstall();
        if (installed) {
          button.remove();
        }
      });

      document.body.appendChild(button);
    }
  }

  private hideInstallButton() {
    const button = document.getElementById('pwa-install-btn');
    if (button) {
      button.remove();
    }
  }

  private showUpdateAvailable() {
    // Show update notification
    const notification = document.createElement('div');
    notification.className = `
      fixed top-4 left-1/2 transform -translate-x-1/2 z-50 
      bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg
      flex items-center gap-3 text-sm font-medium
    `;
    notification.innerHTML = `
      <span>New version available!</span>
      <button class="bg-white/20 px-3 py-1 rounded text-xs hover:bg-white/30" onclick="window.location.reload()">
        Update
      </button>
      <button class="text-white/80 hover:text-white" onclick="this.parentElement.remove()">
        ×
      </button>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }

  // Check if the app is running in standalone mode (installed)
  get isRunningStandalone(): boolean {
    return this.isInstalled || window.matchMedia('(display-mode: standalone)').matches;
  }

  // Request persistent storage for videos
  async requestPersistentStorage(): Promise<boolean> {
    if ('storage' in navigator && 'persist' in navigator.storage) {
      try {
        const granted = await navigator.storage.persist();
        console.log('Persistent storage granted:', granted);
        return granted;
      } catch (error) {
        console.error('Failed to request persistent storage:', error);
        return false;
      }
    }
    return false;
  }

  // Get storage usage information
  async getStorageUsage(): Promise<{used: number, quota: number} | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          quota: estimate.quota || 0
        };
      } catch (error) {
        console.error('Failed to get storage estimate:', error);
        return null;
      }
    }
    return null;
  }

  // Enable wake lock during workout sessions
  async requestWakeLock(): Promise<WakeLockSentinel | null> {
    if ('wakeLock' in navigator) {
      try {
        const wakeLock = await navigator.wakeLock.request('screen');
        console.log('Wake lock acquired');
        
        wakeLock.addEventListener('release', () => {
          console.log('Wake lock released');
        });
        
        return wakeLock;
      } catch (error) {
        console.error('Failed to acquire wake lock:', error);
        return null;
      }
    }
    return null;
  }
}

// Initialize PWA manager
const pwaManager = new PWAManager();

export default pwaManager;