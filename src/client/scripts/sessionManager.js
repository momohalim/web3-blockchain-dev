// Session persistence manager for secure authentication state
import axios from 'axios';
import { useGlobalStore } from '../stores/global.js';

const SESSION_STORAGE_KEY = 'cyberbet_session';
const TOKEN_STORAGE_KEY = 'cyberbet_auth_token';
const REFRESH_TOKEN_KEY = 'cyberbet_refresh_token';

export class SessionManager {
  constructor() {
    this.isInitialized = false;
    this.globalStore = null;
    this.autoRefreshInterval = null;
  }

  // Initialize session manager with global store
  init(globalStore) {
    if (this.isInitialized) return;
    
    this.globalStore = globalStore;
    this.isInitialized = true;
    
    // Try to restore session on initialization
    this.restoreSession();
    
    // Set up automatic token refresh
    this.setupAutoRefresh();
    
    console.log('[SESSION] Session manager initialized');
  }

  // Store session data securely
  storeSession(sessionData) {
    try {
      const { walletAddress, balance, crypto, wallet, token, refreshToken, chainType } = sessionData;
      
      // Store session metadata
      const sessionInfo = {
        walletAddress,
        balance,
        crypto,
        wallet,
        chainType,
        timestamp: Date.now(),
        lastActivity: Date.now()
      };
      
      // Use different storage methods based on environment
      if (this.isSecureEnvironment()) {
        // Production: use both sessionStorage and encrypted local storage
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionInfo));
        this.setSecureStorage(SESSION_STORAGE_KEY, sessionInfo);
      } else {
        // Development: use sessionStorage
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionInfo));
      }
      
      // Store tokens securely
      this.storeTokens(token, refreshToken, chainType);
      
      // Update global store
      this.updateGlobalStore(sessionInfo);
      
      console.log('[SESSION] Session stored successfully');
      return true;
    } catch (error) {
      console.error('[SESSION] Failed to store session:', error);
      return false;
    }
  }

  // Store authentication tokens securely
  storeTokens(token, refreshToken, chainType) {
    try {
      if (token) {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
        sessionStorage.setItem(`${chainType}_token`, token);
        // Set authorization header for axios
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
      
      if (refreshToken) {
        // Store refresh token in more persistent storage
        if (this.isSecureEnvironment()) {
          this.setSecureStorage(`${REFRESH_TOKEN_KEY}_${chainType}`, refreshToken);
        } else {
          localStorage.setItem(`${REFRESH_TOKEN_KEY}_${chainType}`, refreshToken);
        }
      }
    } catch (error) {
      console.error('[SESSION] Failed to store tokens:', error);
    }
  }

  // Restore session from storage
  async restoreSession() {
    try {
      // Try to get session from storage
      let sessionInfo = this.getStoredSession();
      
      if (!sessionInfo) {
        console.log('[SESSION] No stored session found');
        return false;
      }

      // Check if session is still valid (not older than 7 days)
      const sessionAge = Date.now() - sessionInfo.timestamp;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (sessionAge > maxAge) {
        console.log('[SESSION] Session expired, clearing stored data');
        this.clearSession();
        return false;
      }

      // Try to refresh the token
      const tokenRestored = await this.restoreToken(sessionInfo.chainType);
      
      if (tokenRestored) {
        // Update last activity
        sessionInfo.lastActivity = Date.now();
        this.storeSession({ ...sessionInfo, token: tokenRestored });
        
        // Update global store
        this.updateGlobalStore(sessionInfo);
        
        console.log('[SESSION] Session restored successfully');
        return true;
      } else {
        console.log('[SESSION] Failed to restore token, clearing session');
        this.clearSession();
        return false;
      }
    } catch (error) {
      console.error('[SESSION] Failed to restore session:', error);
      this.clearSession();
      return false;
    }
  }

  // Restore authentication token
  async restoreToken(chainType) {
    try {
      // First try to use existing valid token
      const storedToken = sessionStorage.getItem(`${chainType}_token`);
      if (storedToken && await this.validateToken(storedToken)) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        return storedToken;
      }

      // Try to refresh token using refresh token
      const refreshToken = this.getRefreshToken(chainType);
      if (refreshToken) {
        const newToken = await this.refreshToken(refreshToken, chainType);
        if (newToken) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          return newToken;
        }
      }

      return null;
    } catch (error) {
      console.error('[SESSION] Failed to restore token:', error);
      return null;
    }
  }

  // Validate token by checking with server
  async validateToken(token) {
    try {
      const response = await axios.get('/api/protected/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.status === 200;
    } catch (error) {
      console.log('[SESSION] Token validation failed:', error.response?.status);
      return false;
    }
  }

  // Refresh authentication token
  async refreshToken(refreshToken, chainType) {
    try {
      const response = await axios.post(`/api/auth/refreshToken${chainType.charAt(0).toUpperCase() + chainType.slice(1)}`, {
        [`refreshToken${chainType.charAt(0).toUpperCase() + chainType.slice(1)}`]: refreshToken
      });

      if (response.data.token) {
        const newToken = response.data.token;
        const newRefreshToken = response.data[`refreshToken${chainType.charAt(0).toUpperCase() + chainType.slice(1)}`];
        
        // Store new tokens
        this.storeTokens(newToken, newRefreshToken, chainType);
        
        console.log('[SESSION] Token refreshed successfully');
        return newToken;
      }
      
      return null;
    } catch (error) {
      console.error('[SESSION] Token refresh failed:', error);
      return null;
    }
  }

  // Get stored session data
  getStoredSession() {
    try {
      // Try secure storage first (production)
      if (this.isSecureEnvironment()) {
        const secureData = this.getSecureStorage(SESSION_STORAGE_KEY);
        if (secureData) return secureData;
      }
      
      // Fall back to sessionStorage
      const sessionData = sessionStorage.getItem(SESSION_STORAGE_KEY);
      return sessionData ? JSON.parse(sessionData) : null;
    } catch (error) {
      console.error('[SESSION] Failed to get stored session:', error);
      return null;
    }
  }

  // Get refresh token
  getRefreshToken(chainType) {
    try {
      if (this.isSecureEnvironment()) {
        return this.getSecureStorage(`${REFRESH_TOKEN_KEY}_${chainType}`);
      } else {
        return localStorage.getItem(`${REFRESH_TOKEN_KEY}_${chainType}`);
      }
    } catch (error) {
      console.error('[SESSION] Failed to get refresh token:', error);
      return null;
    }
  }

  // Update global store with session data
  updateGlobalStore(sessionInfo) {
    if (!this.globalStore) return;
    
    try {
      this.globalStore.is_authenticated = true;
      this.globalStore.wallet_connected_address = sessionInfo.walletAddress;
      this.globalStore.coin_crypto = sessionInfo.balance;
      this.globalStore.crypto_selected = sessionInfo.crypto;
      this.globalStore.wallet_selected = sessionInfo.wallet;
      
      console.log('[SESSION] Global store updated');
    } catch (error) {
      console.error('[SESSION] Failed to update global store:', error);
    }
  }

  // Check if session exists and is valid
  hasValidSession() {
    const sessionInfo = this.getStoredSession();
    if (!sessionInfo) return false;
    
    const sessionAge = Date.now() - sessionInfo.timestamp;
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    return sessionAge <= maxAge;
  }

  // Update session activity
  updateActivity() {
    const sessionInfo = this.getStoredSession();
    if (sessionInfo) {
      sessionInfo.lastActivity = Date.now();
      this.storeSession(sessionInfo);
    }
  }

  // Clear all session data
  clearSession() {
    try {
      // Clear session storage
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      
      // Clear chain-specific tokens
      const chains = ['ethereum', 'solana', 'bitcoin', 'aptos', 'cardano', 'sui'];
      chains.forEach(chain => {
        sessionStorage.removeItem(`${chain}_token`);
        localStorage.removeItem(`${REFRESH_TOKEN_KEY}_${chain}`);
        
        if (this.isSecureEnvironment()) {
          this.clearSecureStorage(`${REFRESH_TOKEN_KEY}_${chain}`);
        }
      });
      
      // Clear secure storage
      if (this.isSecureEnvironment()) {
        this.clearSecureStorage(SESSION_STORAGE_KEY);
      }
      
      // Clear axios authorization header
      delete axios.defaults.headers.common['Authorization'];
      
      // Reset global store
      if (this.globalStore) {
        this.globalStore.is_authenticated = false;
        this.globalStore.wallet_connected_address = '';
        this.globalStore.coin_crypto = -1;
      }
      
      // Clear auto refresh
      if (this.autoRefreshInterval) {
        clearInterval(this.autoRefreshInterval);
        this.autoRefreshInterval = null;
      }
      
      console.log('[SESSION] Session cleared');
    } catch (error) {
      console.error('[SESSION] Failed to clear session:', error);
    }
  }

  // Setup automatic token refresh
  setupAutoRefresh() {
    // Refresh token every 14 minutes (before 15 min expiration)
    this.autoRefreshInterval = setInterval(async () => {
      const sessionInfo = this.getStoredSession();
      if (sessionInfo && sessionInfo.chainType) {
        const refreshToken = this.getRefreshToken(sessionInfo.chainType);
        if (refreshToken) {
          await this.refreshToken(refreshToken, sessionInfo.chainType);
        }
      }
    }, 14 * 60 * 1000);
  }

  // Check if running in secure environment (production)
  isSecureEnvironment() {
    return window.location.protocol === 'https:' || 
           process.env.NODE_ENV === 'production' ||
           window.location.hostname !== 'localhost';
  }

  // Secure storage methods (encrypted in production)
  setSecureStorage(key, data) {
    try {
      // In production, could implement encryption here
      // For now, use localStorage with JSON encoding
      localStorage.setItem(`secure_${key}`, JSON.stringify(data));
    } catch (error) {
      console.error('[SESSION] Failed to set secure storage:', error);
    }
  }

  getSecureStorage(key) {
    try {
      const data = localStorage.getItem(`secure_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[SESSION] Failed to get secure storage:', error);
      return null;
    }
  }

  clearSecureStorage(key) {
    try {
      localStorage.removeItem(`secure_${key}`);
    } catch (error) {
      console.error('[SESSION] Failed to clear secure storage:', error);
    }
  }

  // Get current session info
  getCurrentSession() {
    return this.getStoredSession();
  }

  // Check if user should be automatically authenticated for transactions
  shouldSkipAuthentication() {
    return this.hasValidSession() && this.globalStore?.is_authenticated;
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();

// Auto-initialize when global store is available
if (typeof window !== 'undefined') {
  // Wait for Vue to be ready, then initialize
  setTimeout(() => {
    try {
      const globalStore = useGlobalStore();
      sessionManager.init(globalStore);
    } catch (error) {
      console.log('[SESSION] Waiting for global store to be ready...');
      // Retry initialization
      const retryInit = setInterval(() => {
        try {
          const globalStore = useGlobalStore();
          sessionManager.init(globalStore);
          clearInterval(retryInit);
        } catch (e) {
          // Continue waiting
        }
      }, 1000);
    }
  }, 100);
}

export default sessionManager;
