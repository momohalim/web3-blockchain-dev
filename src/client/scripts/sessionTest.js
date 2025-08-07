// Test script for session persistence functionality
import { sessionManager } from './sessionManager.js';
import { authChecker } from './authenticationChecker.js';

export class SessionPersistenceTest {
  constructor() {
    this.testResults = [];
  }

  // Run all tests
  async runAllTests() {
    console.log('[SESSION_TEST] Starting session persistence tests...');
    
    this.testResults = [];
    
    // Test 1: Session storage and retrieval
    await this.testSessionStorage();
    
    // Test 2: Token persistence
    await this.testTokenPersistence();
    
    // Test 3: Session expiration
    await this.testSessionExpiration();
    
    // Test 4: Authentication checker
    await this.testAuthenticationChecker();
    
    // Test 5: Environment detection
    await this.testEnvironmentDetection();
    
    // Display results
    this.displayResults();
    
    return this.testResults;
  }

  // Test session storage and retrieval
  async testSessionStorage() {
    try {
      console.log('[SESSION_TEST] Testing session storage...');
      
      const testSessionData = {
        walletAddress: '0x1234567890abcdef',
        balance: 1.5,
        crypto: 'ethereum',
        wallet: 'metamask',
        token: 'test_token_123',
        refreshToken: 'refresh_token_123',
        chainType: 'ethereum'
      };
      
      // Store session
      const stored = sessionManager.storeSession(testSessionData);
      this.addTestResult('Session Storage', stored, 'Session data should be stored successfully');
      
      // Retrieve session
      const retrieved = sessionManager.getStoredSession();
      const retrievedValid = retrieved && retrieved.walletAddress === testSessionData.walletAddress;
      this.addTestResult('Session Retrieval', retrievedValid, 'Session data should be retrieved correctly');
      
      // Clear test data
      sessionManager.clearSession();
      
    } catch (error) {
      this.addTestResult('Session Storage', false, `Error: ${error.message}`);
    }
  }

  // Test token persistence
  async testTokenPersistence() {
    try {
      console.log('[SESSION_TEST] Testing token persistence...');
      
      const testToken = 'test_jwt_token_456';
      const testRefreshToken = 'test_refresh_token_456';
      const chainType = 'ethereum';
      
      // Store tokens
      sessionManager.storeTokens(testToken, testRefreshToken, chainType);
      
      // Check if token was stored in sessionStorage
      const storedToken = sessionStorage.getItem(`${chainType}_token`);
      const tokenStored = storedToken === testToken;
      this.addTestResult('Token Storage', tokenStored, 'JWT token should be stored in sessionStorage');
      
      // Check if refresh token was stored
      const refreshTokenStored = sessionManager.getRefreshToken(chainType) === testRefreshToken;
      this.addTestResult('Refresh Token Storage', refreshTokenStored, 'Refresh token should be stored securely');
      
      // Clear test data
      sessionStorage.removeItem(`${chainType}_token`);
      if (sessionManager.isSecureEnvironment()) {
        sessionManager.clearSecureStorage(`cyberbet_refresh_token_${chainType}`);
      } else {
        localStorage.removeItem(`cyberbet_refresh_token_${chainType}`);
      }
      
    } catch (error) {
      this.addTestResult('Token Persistence', false, `Error: ${error.message}`);
    }
  }

  // Test session expiration
  async testSessionExpiration() {
    try {
      console.log('[SESSION_TEST] Testing session expiration...');
      
      // Create an expired session (older than 7 days)
      const expiredSessionData = {
        walletAddress: '0xexpired',
        balance: 1.0,
        crypto: 'ethereum',
        wallet: 'metamask',
        token: 'expired_token',
        refreshToken: 'expired_refresh',
        chainType: 'ethereum',
        timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days ago
        lastActivity: Date.now() - (8 * 24 * 60 * 60 * 1000)
      };
      
      // Manually store expired session
      sessionStorage.setItem('cyberbet_session', JSON.stringify(expiredSessionData));
      
      // Try to restore - should fail and clear session
      const restored = await sessionManager.restoreSession();
      const shouldBeFalse = !restored;
      this.addTestResult('Session Expiration', shouldBeFalse, 'Expired sessions should not be restored');
      
      // Check if session was cleared
      const sessionCleared = !sessionManager.getStoredSession();
      this.addTestResult('Expired Session Cleanup', sessionCleared, 'Expired sessions should be cleared');
      
    } catch (error) {
      this.addTestResult('Session Expiration', false, `Error: ${error.message}`);
    }
  }

  // Test authentication checker
  async testAuthenticationChecker() {
    try {
      console.log('[SESSION_TEST] Testing authentication checker...');
      
      // Test with no session
      const noSessionCheck = !authChecker.shouldSkipAuthentication();
      this.addTestResult('Auth Checker - No Session', noSessionCheck, 'Should not skip auth when no session exists');
      
      // Create valid session
      const validSessionData = {
        walletAddress: '0xvalid123',
        balance: 2.5,
        crypto: 'ethereum',
        wallet: 'metamask',
        token: 'valid_token_789',
        refreshToken: 'valid_refresh_789',
        chainType: 'ethereum'
      };
      
      sessionManager.storeSession(validSessionData);
      
      // Test with valid session
      const validSessionCheck = authChecker.shouldSkipAuthentication('ethereum');
      this.addTestResult('Auth Checker - Valid Session', validSessionCheck, 'Should skip auth when valid session exists');
      
      // Test wrong chain type
      const wrongChainCheck = !authChecker.shouldSkipAuthentication('solana');
      this.addTestResult('Auth Checker - Wrong Chain', wrongChainCheck, 'Should not skip auth for different chain type');
      
      // Clear test data
      sessionManager.clearSession();
      
    } catch (error) {
      this.addTestResult('Authentication Checker', false, `Error: ${error.message}`);
    }
  }

  // Test environment detection
  async testEnvironmentDetection() {
    try {
      console.log('[SESSION_TEST] Testing environment detection...');
      
      const isSecure = sessionManager.isSecureEnvironment();
      const envDetected = typeof isSecure === 'boolean';
      this.addTestResult('Environment Detection', envDetected, 'Should detect secure environment correctly');
      
      console.log(`[SESSION_TEST] Detected environment: ${isSecure ? 'Secure (Production)' : 'Development'}`);
      
    } catch (error) {
      this.addTestResult('Environment Detection', false, `Error: ${error.message}`);
    }
  }

  // Add test result
  addTestResult(testName, passed, description) {
    const result = {
      test: testName,
      passed: passed,
      description: description,
      timestamp: new Date().toISOString()
    };
    
    this.testResults.push(result);
    
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[SESSION_TEST] ${status}: ${testName} - ${description}`);
  }

  // Display test results
  displayResults() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log('\n[SESSION_TEST] Test Results Summary:');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
      console.log('\nFailed Tests:');
      this.testResults.filter(r => !r.passed).forEach(result => {
        console.log(`❌ ${result.test}: ${result.description}`);
      });
    }
    
    console.log('\n[SESSION_TEST] Session persistence testing completed!');
  }

  // Get test summary
  getTestSummary() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.passed).length;
    
    return {
      total: totalTests,
      passed: passedTests,
      failed: totalTests - passedTests,
      successRate: ((passedTests / totalTests) * 100).toFixed(1),
      results: this.testResults
    };
  }
}

// Export singleton instance
export const sessionTest = new SessionPersistenceTest();

// Auto-run tests in development (can be disabled)
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  // Wait a bit for everything to initialize, then run tests
  setTimeout(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[SESSION_TEST] Auto-running session persistence tests in development mode...');
      sessionTest.runAllTests();
    }
  }, 2000);
}

export default sessionTest;
