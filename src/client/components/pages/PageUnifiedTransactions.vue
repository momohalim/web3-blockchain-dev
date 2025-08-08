<template>
  <div class="unified-transactions">
    <div class="transaction-header">
      <h1 class="title">Unified Blockchain Transactions</h1>
      <p class="subtitle">Send transactions across all supported blockchains</p>
    </div>

    <!-- Transaction Form -->
    <div class="transaction-form">
      <!-- Show current authenticated blockchain and wallet -->
      <div class="current-session" v-if="is_authenticated">
        <h3>Current Session</h3>
        <div class="session-info">
          <div class="session-item">
            <span class="session-label">Blockchain:</span>
            <span class="session-value">{{ getBlockchainInfo(selectedBlockchain)?.name || selectedBlockchain }} ({{ getBlockchainInfo(selectedBlockchain)?.symbol || selectedBlockchain }})</span>
          </div>
          <div class="session-item">
            <span class="session-label">Wallet:</span>
            <span class="session-value">{{ formatWalletName(selectedWallet) }}</span>
          </div>
        </div>
      </div>

      <div class="auth-required" v-else>
        <p>Please authenticate with a wallet to execute transactions.</p>
      </div>

      <div class="form-section" v-if="selectedBlockchain && selectedWallet && is_authenticated">
        <label class="form-label">
          Amount ({{ getBlockchainInfo(selectedBlockchain)?.symbol || selectedBlockchain }})
        </label>
        <input 
          v-model.number="amount" 
          type="number" 
          class="form-input"
          :placeholder="`Enter amount in ${getBlockchainInfo(selectedBlockchain)?.symbol || selectedBlockchain}`"
          :disabled="transactionState.isTransactionInProgress"
          min="0"
          step="0.000001"
        />
        <div class="amount-presets">
          <button 
            v-for="preset in getAmountPresets(selectedBlockchain)" 
            :key="preset.label"
            @click="amount = preset.value"
            class="preset-button"
            :disabled="transactionState.isTransactionInProgress"
          >
            {{ preset.label }}
          </button>
        </div>
      </div>

      <!-- Transaction Controls -->
      <div class="transaction-controls" v-if="selectedBlockchain && selectedWallet && is_authenticated">
        <button 
          @click="executeTransaction"
          class="btn btn-primary transaction-btn"
          :disabled="!canExecuteTransaction"
          :class="{ loading: transactionState.isTransactionInProgress }"
        >
          <span v-if="transactionState.isTransactionInProgress">
            <i class="spinner"></i>
            Processing Transaction...
          </span>
          <span v-else>
            Send {{ amount || 0 }} {{ getBlockchainInfo(selectedBlockchain)?.symbol }}
          </span>
        </button>

        <button 
          @click="executeTestTransaction"
          class="btn btn-secondary test-btn"
          :disabled="transactionState.isTransactionInProgress"
        >
          <span v-if="transactionState.isTransactionInProgress">
            <i class="spinner"></i>
            Processing...
          </span>
          <span v-else>
            Test Transaction (Small Amount)
          </span>
        </button>
      </div>
    </div>

    <!-- Transaction Status -->
    <div class="transaction-status" v-if="transactionState.currentStatus !== 'idle'">
      <div class="status-card" :class="getStatusClass(transactionState.currentStatus)">
        <div class="status-header">
          <h3>Transaction Status</h3>
          <span class="status-badge" :class="transactionState.currentStatus">
            {{ formatStatus(transactionState.currentStatus) }}
          </span>
        </div>
        
        <div class="status-details">
          <div class="detail-item">
            <span class="label">Blockchain:</span>
            <span class="value">{{ transactionState.currentBlockchain }}</span>
          </div>
          
          <div class="detail-item" v-if="transactionState.transactionHash">
            <span class="label">Transaction Hash:</span>
            <span class="value hash">{{ transactionState.transactionHash }}</span>
            <button @click="copyToClipboard(transactionState.transactionHash)" class="copy-btn">
              📋
            </button>
          </div>
          
          <div class="detail-item" v-if="transactionState.error">
            <span class="label">Error:</span>
            <span class="value error">{{ transactionState.error }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Transaction History -->
    <div class="transaction-history">
      <div class="history-header">
        <h3>Recent Transactions</h3>
        <button @click="clearHistory" class="btn btn-small">Clear History</button>
      </div>
      
      <div class="history-list" v-if="transactionHistory.length > 0">
        <div 
          v-for="tx in transactionHistory.slice(0, 10)" 
          :key="tx.id"
          class="history-item"
          :class="tx.status"
        >
          <div class="history-main">
            <div class="history-blockchain">{{ tx.blockchain }}</div>
            <div class="history-amount">
              {{ tx.amount }} {{ getBlockchainInfo(tx.blockchain)?.symbol }}
            </div>
            <div class="history-status" :class="tx.status">{{ formatStatus(tx.status) }}</div>
          </div>
          
          <div class="history-details">
            <div class="history-time">{{ formatTimestamp(tx.timestamp) }}</div>
            <div v-if="tx.hash" class="history-hash">
              Hash: {{ tx.hash.substring(0, 20) }}...
              <button @click="copyToClipboard(tx.hash)" class="copy-btn-small">📋</button>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-history">
        No transactions yet. Send your first transaction above!
      </div>
    </div>

    <!-- Transaction Logs -->
    <div class="transaction-logs">
      <div class="logs-header">
        <h3>Transaction Logs</h3>
        <button @click="clearLogs" class="btn btn-small">Clear Logs</button>
      </div>
      
      <div class="logs-list" v-if="logs.length > 0">
        <div 
          v-for="log in logs.slice(0, 20)" 
          :key="log.id"
          class="log-item"
          :class="log.status"
        >
          <div class="log-time">{{ formatTimestamp(log.timestamp) }}</div>
          <div class="log-blockchain">{{ log.blockchain }}</div>
          <div class="log-message">{{ log.message }}</div>
        </div>
      </div>
      
      <div v-else class="empty-logs">
        No logs yet. Transaction logs will appear here.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import {
  executeUnifiedTransaction,
  testTransaction,
  transactionState,
  transactionHistory,
  transactionLogger,
  getSupportedBlockchains,
  getBlockchainInfo,
  resetTransactionState,
  clearTransactionHistory,
  TransactionStatus
} from '@/client/scripts/unifiedTransactionManager.js';
import { cryptobet } from '@/client/scripts/cryptobet.js';
import { useGlobalStore } from '@/client/stores/global.js';
import { storeToRefs } from 'pinia';

// Get global store values
const globalStore = useGlobalStore();
const { crypto_selected, wallet_selected, is_authenticated } = storeToRefs(globalStore);

// Reactive data
const amount = ref(0);

// Use global store values automatically
const selectedBlockchain = computed(() => crypto_selected.value);
const selectedWallet = computed(() => wallet_selected.value);

// Computed properties
const supportedBlockchains = computed(() => getSupportedBlockchains());

const logs = computed(() => transactionLogger.getLogs());

const canExecuteTransaction = computed(() => {
  return selectedBlockchain.value &&
         selectedWallet.value &&
         amount.value > 0 &&
         is_authenticated.value &&
         !transactionState.isTransactionInProgress;
});

// Methods
function getAvailableWallets(blockchain) {
  if (!blockchain || !cryptobet[blockchain]) return [];
  
  return Object.keys(cryptobet[blockchain]).filter(wallet => {
    return cryptobet[blockchain][wallet]?.installed;
  });
}

function formatWalletName(wallet) {
  return wallet.charAt(0).toUpperCase() + wallet.slice(1);
}

function getAmountPresets(blockchain) {
  const presets = {
    ethereum: [
      { label: '0.001 ETH', value: 0.001 },
      { label: '0.01 ETH', value: 0.01 },
      { label: '0.1 ETH', value: 0.1 }
    ],
    solana: [
      { label: '0.01 SOL', value: 0.01 },
      { label: '0.1 SOL', value: 0.1 },
      { label: '1 SOL', value: 1 }
    ],
    bitcoin: [
      { label: '0.0001 BTC', value: 0.0001 },
      { label: '0.001 BTC', value: 0.001 },
      { label: '0.01 BTC', value: 0.01 }
    ],
    aptos: [
      { label: '0.01 APT', value: 0.01 },
      { label: '0.1 APT', value: 0.1 },
      { label: '1 APT', value: 1 }
    ],
    cardano: [
      { label: '5 ADA', value: 5 },
      { label: '10 ADA', value: 10 },
      { label: '50 ADA', value: 50 }
    ],
    sui: [
      { label: '0.01 SUI', value: 0.01 },
      { label: '0.1 SUI', value: 0.1 },
      { label: '1 SUI', value: 1 }
    ]
  };
  
  return presets[blockchain] || [];
}

function getStatusClass(status) {
  return {
    'status-pending': status === TransactionStatus.PENDING,
    'status-success': status === TransactionStatus.SUCCESS,
    'status-failed': status === TransactionStatus.FAILED
  };
}

function formatStatus(status) {
  const statusMap = {
    [TransactionStatus.IDLE]: 'Idle',
    [TransactionStatus.PENDING]: 'Pending',
    [TransactionStatus.SUCCESS]: 'Success',
    [TransactionStatus.FAILED]: 'Failed'
  };
  return statusMap[status] || status;
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString();
}

async function executeTransaction() {
  if (!canExecuteTransaction.value) return;
  
  try {
    const result = await executeUnifiedTransaction(
      selectedBlockchain.value,
      amount.value,
      selectedWallet.value,
      onTransactionComplete
    );
    
    console.log('Transaction completed:', result);
  } catch (error) {
    console.error('Transaction failed:', error);
  }
}

async function executeTestTransaction() {
  if (!selectedBlockchain.value || !selectedWallet.value) return;
  
  try {
    const result = await testTransaction(
      selectedBlockchain.value,
      selectedWallet.value,
      onTransactionComplete
    );
    
    console.log('Test transaction completed:', result);
  } catch (error) {
    console.error('Test transaction failed:', error);
  }
}

function onTransactionComplete(result) {
  console.log('Transaction callback:', result);
  
  if (result.success) {
    // Show success notification
    showNotification('Transaction completed successfully!', 'success');
  } else {
    // Show error notification
    showNotification(`Transaction failed: ${result.error}`, 'error');
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification('Copied to clipboard!', 'info');
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
}

function clearHistory() {
  clearTransactionHistory();
  showNotification('Transaction history cleared', 'info');
}

function clearLogs() {
  transactionLogger.clearLogs();
  showNotification('Transaction logs cleared', 'info');
}

function showNotification(message, type = 'info') {
  // Simple notification - in a real app, you'd use a proper notification system
  console.log(`[${type.toUpperCase()}] ${message}`);
  
  // Create a simple toast notification
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'success' ? '#4ade80' : type === 'error' ? '#f87171' : '#60a5fa'};
    color: white;
    border-radius: 6px;
    z-index: 10000;
    transition: opacity 0.3s;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// Remove blockchain change watcher since we're using global values

// Lifecycle
onMounted(() => {
  console.log('Unified Transactions component mounted');
  resetTransactionState();
});
</script>

<style scoped>
.unified-transactions {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Arial', sans-serif;
}

.transaction-header {
  text-align: center;
  margin-bottom: 40px;
}

.title {
  font-size: 2.5rem;
  font-weight: bold;
  color: #00ff88;
  margin-bottom: 10px;
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.3);
}

.subtitle {
  font-size: 1.2rem;
  color: #888;
  margin: 0;
}

.transaction-form {
  background: rgba(0, 20, 40, 0.8);
  border: 1px solid #00ff88;
  border-radius: 12px;
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: 0 0 20px rgba(0, 255, 136, 0.1);
}

.form-section {
  margin-bottom: 25px;
}

.current-session {
  background: rgba(0, 255, 136, 0.1);
  border: 1px solid #00ff88;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 25px;
}

.current-session h3 {
  color: #00ff88;
  margin: 0 0 15px 0;
  font-size: 1.2rem;
}

.session-info {
  display: grid;
  gap: 10px;
}

.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-label {
  font-weight: bold;
  color: #00ff88;
}

.session-value {
  color: white;
  font-weight: bold;
}

.auth-required {
  text-align: center;
  padding: 40px;
  color: #888;
  font-style: italic;
}

.form-label {
  display: block;
  font-weight: bold;
  color: #00ff88;
  margin-bottom: 8px;
  font-size: 1.1rem;
}

.form-select,
.form-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #333;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.form-select:focus,
.form-input:focus {
  outline: none;
  border-color: #00ff88;
  box-shadow: 0 0 10px rgba(0, 255, 136, 0.2);
}

.form-select:disabled,
.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.amount-presets {
  display: flex;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.preset-button {
  padding: 8px 16px;
  border: 1px solid #00ff88;
  border-radius: 6px;
  background: transparent;
  color: #00ff88;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.9rem;
}

.preset-button:hover:not(:disabled) {
  background: #00ff88;
  color: black;
}

.preset-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.transaction-controls {
  display: flex;
  gap: 20px;
  margin-top: 30px;
}

.btn {
  padding: 14px 28px;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 200px;
  position: relative;
}

.btn-primary {
  background: linear-gradient(45deg, #00ff88, #00cc70);
  color: black;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 255, 136, 0.3);
}

.btn-secondary {
  background: transparent;
  border: 2px solid #00ff88;
  color: #00ff88;
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(0, 255, 136, 0.1);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn.loading {
  pointer-events: none;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 8px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.transaction-status {
  margin-bottom: 30px;
}

.status-card {
  border-radius: 12px;
  padding: 25px;
  border-left: 5px solid;
}

.status-pending {
  background: rgba(255, 193, 7, 0.1);
  border-left-color: #ffc107;
}

.status-success {
  background: rgba(0, 255, 136, 0.1);
  border-left-color: #00ff88;
}

.status-failed {
  background: rgba(248, 113, 113, 0.1);
  border-left-color: #f87171;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.status-header h3 {
  margin: 0;
  color: white;
}

.status-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: bold;
  text-transform: uppercase;
}

.status-badge.pending {
  background: #ffc107;
  color: black;
}

.status-badge.success {
  background: #00ff88;
  color: black;
}

.status-badge.failed {
  background: #f87171;
  color: white;
}

.status-details {
  display: grid;
  gap: 12px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-item .label {
  font-weight: bold;
  color: #aaa;
  min-width: 120px;
}

.detail-item .value {
  color: white;
  flex: 1;
}

.detail-item .value.hash {
  font-family: monospace;
  font-size: 0.9rem;
  word-break: break-all;
}

.detail-item .value.error {
  color: #f87171;
}

.copy-btn,
.copy-btn-small {
  background: transparent;
  border: 1px solid #666;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  color: #666;
  transition: all 0.3s ease;
}

.copy-btn:hover,
.copy-btn-small:hover {
  border-color: #00ff88;
  color: #00ff88;
}

.transaction-history,
.transaction-logs {
  background: rgba(0, 20, 40, 0.6);
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 30px;
}

.history-header,
.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.history-header h3,
.logs-header h3 {
  margin: 0;
  color: #00ff88;
}

.btn-small {
  padding: 8px 16px;
  font-size: 0.9rem;
  background: transparent;
  border: 1px solid #666;
  color: #666;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-small:hover {
  border-color: #00ff88;
  color: #00ff88;
}

.history-list,
.logs-list {
  max-height: 400px;
  overflow-y: auto;
}

.history-item {
  border: 1px solid #333;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 12px;
  transition: all 0.3s ease;
}

.history-item:hover {
  border-color: #00ff88;
  background: rgba(0, 255, 136, 0.05);
}

.history-item.success {
  border-left: 4px solid #00ff88;
}

.history-item.failed {
  border-left: 4px solid #f87171;
}

.history-item.pending {
  border-left: 4px solid #ffc107;
}

.history-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.history-blockchain {
  font-weight: bold;
  color: #00ff88;
  text-transform: capitalize;
}

.history-amount {
  color: white;
  font-weight: bold;
}

.history-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: bold;
  text-transform: uppercase;
}

.history-status.success {
  background: rgba(0, 255, 136, 0.2);
  color: #00ff88;
}

.history-status.failed {
  background: rgba(248, 113, 113, 0.2);
  color: #f87171;
}

.history-status.pending {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
}

.history-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
  color: #888;
}

.history-hash {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: monospace;
}

.log-item {
  display: flex;
  gap: 15px;
  padding: 10px 15px;
  border-radius: 6px;
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.log-item.success {
  background: rgba(0, 255, 136, 0.1);
}

.log-item.failed {
  background: rgba(248, 113, 113, 0.1);
}

.log-item.pending {
  background: rgba(255, 193, 7, 0.1);
}

.log-time {
  color: #888;
  min-width: 150px;
  font-family: monospace;
  font-size: 0.8rem;
}

.log-blockchain {
  color: #00ff88;
  font-weight: bold;
  min-width: 80px;
  text-transform: capitalize;
}

.log-message {
  color: white;
  flex: 1;
}

.empty-history,
.empty-logs {
  text-align: center;
  color: #666;
  padding: 40px;
  font-style: italic;
}

.auth-required {
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid #f87171;
  border-radius: 8px;
  padding: 30px;
  margin: 20px 0;
}

/* Responsive Design */
@media (max-width: 768px) {
  .unified-transactions {
    padding: 15px;
  }
  
  .title {
    font-size: 2rem;
  }
  
  .transaction-form {
    padding: 20px;
  }
  
  .transaction-controls {
    flex-direction: column;
  }
  
  .btn {
    min-width: auto;
  }
  
  .history-main {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .history-details {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .amount-presets {
    justify-content: center;
  }
}
</style>
