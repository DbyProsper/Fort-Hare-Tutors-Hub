/**
 * Singleton notification sound manager
 * Preloads audio once and prevents duplicate plays
 */

interface NotificationSoundManager {
  play: () => Promise<void>;
  isSupported: () => boolean;
}

class NotificationAudioManager implements NotificationSoundManager {
  private audio: HTMLAudioElement | null = null;
  private lastPlayTime: number = 0;
  private debounceMs: number = 500;
  private isLoading: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (typeof document === 'undefined') return;

    try {
      this.audio = new Audio('/notification.mp3');
      this.audio.preload = 'auto';
      // Suppress errors if audio load fails
      this.audio.onerror = () => {
        console.warn('Failed to load notification sound');
      };
    } catch (error) {
      console.error('Failed to create Audio element:', error);
    }
  }

  public isSupported(): boolean {
    return this.audio !== null && !this.isLoading;
  }

  public async play(): Promise<void> {
    if (!this.audio) {
      this.initialize();
      if (!this.audio) return;
    }

    // Debounce multiple rapid calls
    const now = Date.now();
    if (now - this.lastPlayTime < this.debounceMs) {
      return;
    }

    this.lastPlayTime = now;

    try {
      // Only play if page is visible
      if (document.visibilityState === 'visible') {
        this.audio.currentTime = 0;
        await this.audio.play();
      }
    } catch (error) {
      // Silently handle autoplay restrictions and other errors
      if (error instanceof Error) {
        if (!error.message.includes('NotAllowedError')) {
          console.warn('Notification sound play failed:', error.message);
        }
      }
    }
  }
}

// Create singleton instance
const notificationSoundManager = new NotificationAudioManager();

export const playNotificationSound = async (): Promise<void> => {
  return notificationSoundManager.play();
};

export const isNotificationSoundSupported = (): boolean => {
  return notificationSoundManager.isSupported();
};
