<template>
  <div class="background-and-buttons">
    <!-- Background -->
    <div class="cyber-background">
      <div class="grid-overlay"></div>
      <div class="glow-effect"></div>
    </div>

    <!-- Navigation Buttons -->
    <div class="navigation-controls">
      <button 
        @click="navigateTo('jackin')"
        class="nav-btn"
        :class="{ active: currentPage === 'jackin' }"
      >
        <span class="btn-text">JACK IN</span>
      </button>
      
      <button 
        @click="navigateTo('games')"
        class="nav-btn"
        :class="{ active: currentPage === 'games' }"
      >
        <span class="btn-text">GAMES</span>
      </button>
      
      <button 
        @click="navigateTo('shop')"
        class="nav-btn"
        :class="{ active: currentPage === 'shop', disabled: !isAuthenticated }"
        :disabled="!isAuthenticated"
      >
        <span class="btn-text">SHOP</span>
      </button>
      
      <button 
        @click="navigateTo('transactions')"
        class="nav-btn cyberpunk-highlight"
        :class="{ active: currentPage === 'transactions' }"
      >
        <span class="btn-text">TRANSACTIONS</span>
        <span class="btn-subtitle">NEW!</span>
      </button>
    </div>

    <!-- Quick Stats (if authenticated) -->
    <div class="quick-stats" v-if="isAuthenticated">
      <div class="stat-item">
        <span class="stat-label">Wallet:</span>
        <span class="stat-value">{{ formatAddress(walletAddress) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Balance:</span>
        <span class="stat-value">{{ formatBalance(coinCrypto) }} {{ cryptoSelected.toUpperCase() }}</span>
      </div>
    </div>

    <!-- Connection Status -->
    <div class="connection-status">
      <div class="status-indicator" :class="{ connected: isAuthenticated }">
        <div class="status-dot"></div>
        <span class="status-text">
          {{ isAuthenticated ? 'CONNECTED' : 'DISCONNECTED' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useGlobalStore } from '@/client/stores/global.js';
import { storeToRefs } from 'pinia';

// Store
const store = useGlobalStore();
const {
  navigation_state_page,
  is_authenticated,
  wallet_connected_address,
  coin_crypto,
  crypto_selected
} = storeToRefs(store);

// Computed properties
const currentPage = computed(() => navigation_state_page.value);
const isAuthenticated = computed(() => is_authenticated.value);
const walletAddress = computed(() => wallet_connected_address.value);
const coinCrypto = computed(() => coin_crypto.value);
const cryptoSelected = computed(() => crypto_selected.value);

// Methods
function navigateTo(page) {
  // Only allow shop access if authenticated
  if (page === 'shop' && !isAuthenticated.value) {
    console.warn('Shop access requires authentication');
    return;
  }
  
  navigation_state_page.value = page;
  console.log(`Navigating to: ${page}`);
}

function formatAddress(address) {
  if (!address) return 'N/A';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBalance(balance) {
  if (balance === -1 || balance === null || balance === undefined) return '0.00';
  return parseFloat(balance).toFixed(4);
}
</script>

<style scoped>
.background-and-buttons {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: 
    radial-gradient(ellipse at top, rgba(0, 255, 136, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at bottom, rgba(0, 100, 255, 0.1) 0%, transparent 50%),
    linear-gradient(180deg, #000a0f 0%, #001122 50%, #000a0f 100%);
  z-index: -1;
  overflow: hidden;
}

.cyber-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.grid-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: 
    linear-gradient(rgba(0, 255, 136, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 255, 136, 0.1) 1px, transparent 1px);
  background-size: 50px 50px;
  animation: gridMove 20s linear infinite;
}

.glow-effect {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(0, 255, 136, 0.3) 0%, transparent 70%);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: pulse 4s ease-in-out infinite;
}

@keyframes gridMove {
  0% { transform: translate(0, 0); }
  100% { transform: translate(50px, 50px); }
}

@keyframes pulse {
  0%, 100% { 
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.3;
  }
  50% { 
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 0.6;
  }
}

.navigation-controls {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 20px;
  z-index: 1000;
  padding: 20px;
  background: rgba(0, 20, 40, 0.8);
  border: 2px solid #00ff88;
  border-radius: 15px;
  backdrop-filter: blur(10px);
  box-shadow: 0 0 30px rgba(0, 255, 136, 0.3);
}

.nav-btn {
  position: relative;
  padding: 12px 24px;
  background: transparent;
  border: 2px solid #333;
  border-radius: 8px;
  color: #888;
  font-family: 'Arial', sans-serif;
  font-weight: bold;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 1px;
  min-width: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.nav-btn:hover:not(:disabled) {
  border-color: #00ff88;
  color: #00ff88;
  box-shadow: 0 0 15px rgba(0, 255, 136, 0.5);
  transform: translateY(-2px);
}

.nav-btn.active {
  border-color: #00ff88;
  color: #00ff88;
  background: rgba(0, 255, 136, 0.1);
  box-shadow: 0 0 20px rgba(0, 255, 136, 0.4);
}

.nav-btn.cyberpunk-highlight {
  border-color: #ff6b00;
  color: #ff6b00;
  background: rgba(255, 107, 0, 0.1);
  box-shadow: 0 0 15px rgba(255, 107, 0, 0.3);
  animation: highlightPulse 2s ease-in-out infinite;
}

.nav-btn.cyberpunk-highlight:hover {
  border-color: #ff6b00;
  color: #ff6b00;
  box-shadow: 0 0 25px rgba(255, 107, 0, 0.6);
}

.nav-btn.cyberpunk-highlight.active {
  border-color: #ff6b00;
  color: #ff6b00;
  background: rgba(255, 107, 0, 0.2);
  box-shadow: 0 0 30px rgba(255, 107, 0, 0.5);
}

@keyframes highlightPulse {
  0%, 100% { 
    box-shadow: 0 0 15px rgba(255, 107, 0, 0.3);
  }
  50% { 
    box-shadow: 0 0 25px rgba(255, 107, 0, 0.6);
  }
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.nav-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-text {
  font-size: 1rem;
  line-height: 1;
}

.btn-subtitle {
  font-size: 0.7rem;
  margin-top: 2px;
  opacity: 0.8;
  animation: blink 1.5s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 0.3; }
}

.quick-stats {
  position: fixed;
  top: 80px;
  right: 30px;
  z-index: 1000;
  padding: 15px 20px;
  background: rgba(0, 20, 40, 0.9);
  border: 1px solid #00ff88;
  border-radius: 10px;
  backdrop-filter: blur(10px);
  box-shadow: 0 0 20px rgba(0, 255, 136, 0.2);
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 15px;
}

.stat-item:last-child {
  margin-bottom: 0;
}

.stat-label {
  color: #888;
  font-size: 0.9rem;
  font-weight: bold;
}

.stat-value {
  color: #00ff88;
  font-size: 0.9rem;
  font-family: monospace;
}

.connection-status {
  position: fixed;
  top: 30px;
  right: 30px;
  z-index: 1000;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(0, 20, 40, 0.9);
  border: 1px solid #666;
  border-radius: 20px;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.status-indicator.connected {
  border-color: #00ff88;
  box-shadow: 0 0 15px rgba(0, 255, 136, 0.3);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
  transition: all 0.3s ease;
}

.status-indicator.connected .status-dot {
  background: #00ff88;
  box-shadow: 0 0 8px rgba(0, 255, 136, 0.6);
  animation: statusPulse 2s ease-in-out infinite;
}

@keyframes statusPulse {
  0%, 100% { 
    box-shadow: 0 0 8px rgba(0, 255, 136, 0.6);
  }
  50% { 
    box-shadow: 0 0 12px rgba(0, 255, 136, 1);
  }
}

.status-text {
  color: #666;
  font-size: 0.8rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.3s ease;
}

.status-indicator.connected .status-text {
  color: #00ff88;
}

/* Responsive Design */
@media (max-width: 768px) {
  .navigation-controls {
    bottom: 20px;
    left: 20px;
    right: 20px;
    transform: none;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    padding: 15px;
  }
  
  .nav-btn {
    min-width: 100px;
    padding: 10px 16px;
    font-size: 0.9rem;
  }
  
  .btn-subtitle {
    font-size: 0.6rem;
  }
  
  .quick-stats {
    top: 60px;
    right: 20px;
    padding: 12px 16px;
  }
  
  .stat-label,
  .stat-value {
    font-size: 0.8rem;
  }
  
  .connection-status {
    top: 20px;
    right: 20px;
  }
  
  .status-indicator {
    padding: 6px 12px;
  }
  
  .status-text {
    font-size: 0.7rem;
  }
}

@media (max-width: 480px) {
  .navigation-controls {
    bottom: 10px;
    left: 10px;
    right: 10px;
    padding: 10px;
    gap: 8px;
  }
  
  .nav-btn {
    min-width: 80px;
    padding: 8px 12px;
    font-size: 0.8rem;
  }
  
  .btn-text {
    font-size: 0.8rem;
  }
  
  .btn-subtitle {
    font-size: 0.5rem;
  }
  
  .quick-stats {
    display: none; /* Hide on very small screens */
  }
}
</style>
