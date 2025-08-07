// Authentication checker for transaction flows
import { sessionManager } from './sessionManager.js';
import { useGlobalStore } from '../stores/global.js';

export class AuthenticationChecker {
  constructor() {
    this.globalStore = null;
  }

  // Initialize with global store
  init() {
    try {
      this.globalStore = useGlobalStore();
    } catch (error) {
      console.warn('[AUTH_CHECKER] Global store not ready, will retry later');
    }
  }

  // Check if user should skip authentication for transactions
  shouldSkipAuthentication(chainType = null) {
    // Ensure session manager is initialized
    if (!sessionManager.isInitialized) {
      return false;
    }

    // Check if session exists and is valid
    if (!sessionManager.hasValidSession()) {
      return false;
    }

    // Get current session
    const currentSession = sessionManager.getCurrentSession();
    if (!currentSession) {
      return false;
    }

    // Check if global store indicates authentication
    if (!this.globalStore) {
      this.init();
    }

    if (this.globalStore && !this.globalStore.is_authenticated) {
      return false;
    }

    // If specific chain type is requested, check if it matches
    if (chainType && currentSession.chainType !== chainType) {
      return false;
    }

    // All checks passed
    return true;
  }

  // Get the current authenticated chain type
  getCurrentChainType() {
    const session = sessionManager.getCurrentSession();
    return session ? session.chainType : null;
  }

  // Get current wallet type
  getCurrentWalletType() {
    const session = sessionManager.getCurrentSession();
    return session ? session.wallet : null;
  }

  // Get current wallet address
  getCurrentWalletAddress() {
    const session = sessionManager.getCurrentSession();
    return session ? session.walletAddress : null;
  }

  // Check if specific chain/wallet combination is authenticated
  isChainWalletAuthenticated(chainType, walletType) {
    if (!this.shouldSkipAuthentication()) {
      return false;
    }

    const session = sessionManager.getCurrentSession();
    return session && 
           session.chainType === chainType && 
           session.wallet === walletType;
  }

  // Get authentication status with details
  getAuthenticationStatus() {
    const session = sessionManager.getCurrentSession();
    const hasValidSession = sessionManager.hasValidSession();
    const globalAuth = this.globalStore ? this.globalStore.is_authenticated : false;

    return {
      isAuthenticated: hasValidSession && globalAuth,
      session: session,
      chainType: session ? session.chainType : null,
      walletType: session ? session.wallet : null,
      walletAddress: session ? session.walletAddress : null,
      balance: session ? session.balance : null,
      canSkipAuth: this.shouldSkipAuthentication()
    };
  }

  // Update session activity (call this when user interacts with the app)
  updateActivity() {
    sessionManager.updateActivity();
  }

  // Force re-authentication (call this when authentication fails)
  forceReAuthentication() {
    sessionManager.clearSession();
    if (this.globalStore) {
      this.globalStore.is_authenticated = false;
      this.globalStore.wallet_connected_address = '';
      this.globalStore.coin_crypto = -1;
    }
  }
}

// Export singleton instance
export const authChecker = new AuthenticationChecker();

// Auto-initialize
if (typeof window !== 'undefined') {
  setTimeout(() => {
    authChecker.init();
  }, 100);
}

export default authChecker;
