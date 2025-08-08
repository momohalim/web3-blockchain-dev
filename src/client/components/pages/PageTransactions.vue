<template>
  <div class="transaction-interface">
    <div class="transaction-header">
      <h1 class="page-title">Blockchain Transactions</h1>
      <p class="page-subtitle">Execute real transactions across all supported blockchains</p>
    </div>

    <div class="transaction-form-container">
      <div class="blockchain-selector">
        <h3>Select Blockchain</h3>
        <div class="blockchain-grid">
          <div 
            v-for="blockchain in blockchains" 
            :key="blockchain.id"
            :class="['blockchain-card', { active: selectedBlockchain === blockchain.id }]"
            @click="selectBlockchain(blockchain.id)"
          >
            <div class="blockchain-icon">{{ blockchain.icon }}</div>
            <div class="blockchain-name">{{ blockchain.name }}</div>
            <div class="blockchain-status" :class="blockchain.status">
              {{ blockchain.status }}
            </div>
          </div>
        </div>
      </div>

      <div class="transaction-form" v-if="selectedBlockchain">
        <div class="form-group">
          <label for="amount">Amount</label>
          <input 
            id="amount"
            type="number" 
            v-model="transactionAmount" 
            :placeholder="getAmountPlaceholder()"
            step="0.001"
            min="0.001"
            class="amount-input"
          />
          <span class="currency-label">{{ getCurrencySymbol() }}</span>
        </div>

        <div class="wallet-status" v-if="walletInfo">
          <div class="wallet-info">
            <strong>Connected Wallet:</strong> {{ walletInfo.address }}
          </div>
          <div class="balance-info">
            <strong>Balance:</strong> {{ walletInfo.balance }} {{ getCurrencySymbol() }}
          </div>
        </div>

        <button 
          class="execute-button"
          @click="executeTransaction"
          :disabled="!canExecuteTransaction"
          :class="{ loading: isExecuting }"
        >
          <span v-if="!isExecuting">Execute Transaction</span>
          <span v-else>Processing...</span>
        </button>
      </div>
    </div>

    <div class="transaction-status" v-if="currentTransaction">
      <h3>Transaction Status</h3>
      <div class="status-card" :class="currentTransaction.status">
        <div class="status-info">
          <div class="status-badge">{{ currentTransaction.status.toUpperCase() }}</div>
          <div class="transaction-details">
            <p><strong>Transaction ID:</strong> {{ currentTransaction.id }}</p>
            <p><strong>Blockchain:</strong> {{ currentTransaction.chainType }}</p>
            <p><strong>Amount:</strong> {{ currentTransaction.amount }} {{ getCurrencySymbol() }}</p>
            <p v-if="currentTransaction.txHash"><strong>TX Hash:</strong> 
              <a :href="getExplorerLink(currentTransaction.txHash)" target="_blank" class="hash-link">
                {{ currentTransaction.txHash }}
              </a>
            </p>
            <p v-if="currentTransaction.error"><strong>Error:</strong> {{ currentTransaction.error }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="transaction-history">
      <h3>Transaction History</h3>
      <div class="history-container">
        <div 
          v-for="transaction in transactionHistory" 
          :key="transaction.id"
          class="history-item"
          :class="transaction.status"
        >
          <div class="history-header">
            <span class="history-blockchain">{{ transaction.chainType }}</span>
            <span class="history-amount">{{ transaction.amount }} {{ getSymbolForChain(transaction.chainType) }}</span>
            <span class="history-status" :class="transaction.status">{{ transaction.status }}</span>
          </div>
          <div class="history-details">
            <p>{{ formatDate(transaction.startTime) }}</p>
            <p v-if="transaction.txHash">
              <a :href="getExplorerLinkForChain(transaction.chainType, transaction.txHash)" target="_blank">
                View on Explorer
              </a>
            </p>
          </div>
        </div>
        <div v-if="transactionHistory.length === 0" class="no-history">
          No transactions yet
        </div>
      </div>
    </div>

    <div class="logs-section">
      <h3>
        Transaction Logs 
        <button @click="toggleLogs" class="toggle-logs-btn">
          {{ showLogs ? 'Hide' : 'Show' }} Logs
        </button>
      </h3>
      <div v-if="showLogs" class="logs-container">
        <div 
          v-for="log in transactionLogs" 
          :key="log.timestamp"
          class="log-entry"
        >
          <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          <span class="log-action">{{ log.action }}</span>
          <span class="log-details">{{ formatLogDetails(log) }}</span>
        </div>
        <div v-if="transactionLogs.length === 0" class="no-logs">
          No logs available
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useGlobalStore } from '@/client/stores/global';
import { storeToRefs } from 'pinia';
import { 
  executeBlockchainTransaction, 
  transactionManager, 
  transactionLogger,
  TRANSACTION_STATUS 
} from '@/client/scripts/transactionManager';

// Import blockchain specific modules
import { cryptobet } from '@/client/scripts/cryptobet';
import { authChecker } from '@/client/scripts/authenticationChecker.js';

const store = useGlobalStore();
const { 
  is_authenticated, 
  wallet_connected_address, 
  coin_crypto, 
  crypto_selected, 
  wallet_selected 
} = storeToRefs(store);

// Component state - automatically use global store values
const selectedBlockchain = computed(() => crypto_selected.value);
const transactionAmount = ref(0.001);
const isExecuting = ref(false);
const currentTransaction = ref(null);
const transactionHistory = ref([]);
const transactionLogs = ref([]);
const showLogs = ref(false);

// Blockchain configuration
const blockchains = ref([
  { 
    id: 'ethereum', 
    name: 'Ethereum', 
    icon: '⟠', 
    status: 'ready',
    symbol: 'ETH',
    explorer: 'https://etherscan.io/tx/'
  },
  { 
    id: 'solana', 
    name: 'Solana', 
    icon: '◎', 
    status: 'ready',
    symbol: 'SOL',
    explorer: 'https://explorer.solana.com/tx/'
  },
  { 
    id: 'bitcoin', 
    name: 'Bitcoin', 
    icon: '₿', 
    status: 'ready',
    symbol: 'BTC',
    explorer: 'https://blockstream.info/tx/'
  },
  { 
    id: 'aptos', 
    name: 'Aptos', 
    icon: 'Ⱥ', 
    status: 'ready',
    symbol: 'APT',
    explorer: 'https://explorer.aptoslabs.com/txn/'
  },
  { 
    id: 'cardano', 
    name: 'Cardano', 
    icon: '₳', 
    status: 'ready',
    symbol: 'ADA',
    explorer: 'https://cardanoscan.io/transaction/'
  },
  { 
    id: 'sui', 
    name: 'Sui', 
    icon: '⚡', 
    status: 'ready',
    symbol: 'SUI',
    explorer: 'https://suivision.xyz/txblock/'
  }
]);

// Computed properties
const walletInfo = computed(() => {
  if (!is_authenticated.value) return null;
  return {
    address: wallet_connected_address.value,
    balance: coin_crypto.value
  };
});

const canExecuteTransaction = computed(() => {
  // Check if we have a valid session or are authenticated
  const hasValidAuth = is_authenticated.value || authChecker.shouldSkipAuthentication(selectedBlockchain.value);

  return selectedBlockchain.value &&
         transactionAmount.value > 0 &&
         hasValidAuth &&
         !isExecuting.value;
});

// Methods - remove manual selection since we use global store
// function selectBlockchain(blockchainId) {
//   selectedBlockchain.value = blockchainId;
//   // Update blockchain status based on wallet connectivity
//   updateBlockchainStatus(blockchainId);
// }

function updateBlockchainStatus(blockchainId) {
  const blockchain = blockchains.value.find(b => b.id === blockchainId);
  if (blockchain) {
    // Check if wallet is connected for this blockchain
    const hasWallet = checkWalletAvailability(blockchainId);
    blockchain.status = hasWallet ? 'ready' : 'disconnected';
  }
}

function checkWalletAvailability(blockchainId) {
  switch (blockchainId) {
    case 'ethereum':
      return cryptobet.ethereum && Object.values(cryptobet.ethereum).some(w => w.installed);
    case 'solana':
      return cryptobet.solana && Object.values(cryptobet.solana).some(w => w.installed);
    case 'bitcoin':
      return cryptobet.bitcoin && Object.values(cryptobet.bitcoin).some(w => w.installed);
    case 'aptos':
      return cryptobet.aptos && Object.values(cryptobet.aptos).some(w => w.installed);
    case 'cardano':
      return cryptobet.cardano && Object.values(cryptobet.cardano).some(w => w.installed);
    case 'sui':
      return cryptobet.sui && Object.values(cryptobet.sui).some(w => w.installed);
    default:
      return false;
  }
}

function getWalletProvider() {
  // Always use the global store selected wallet and blockchain
  const blockchainId = selectedBlockchain.value;
  const walletId = wallet_selected.value;

  if (!blockchainId || !walletId) return null;

  switch (blockchainId) {
    case 'ethereum':
      return cryptobet.ethereum[walletId]?.provider;
    case 'solana':
      return cryptobet.solana[walletId]?.provider;
    case 'bitcoin':
      return cryptobet.bitcoin[walletId]?.provider;
    case 'aptos':
      return cryptobet.aptos[walletId]?.provider;
    case 'cardano':
      return cryptobet.cardano[walletId]?.provider;
    case 'sui':
      return cryptobet.sui[walletId]?.provider;
    default:
      return null;
  }
}

async function executeTransaction() {
  if (!canExecuteTransaction.value) return;

  // Check if we can skip authentication
  if (authChecker.shouldSkipAuthentication(selectedBlockchain.value)) {
    console.log('[TRANSACTION] Using existing session, skipping wallet connection');
    authChecker.updateActivity();
  } else if (!is_authenticated.value) {
    throw new Error('Please connect your wallet first');
  }

  isExecuting.value = true;
  currentTransaction.value = null;

  try {
    const walletProvider = getWalletProvider(selectedBlockchain.value);
    if (!walletProvider && !authChecker.shouldSkipAuthentication(selectedBlockchain.value)) {
      throw new Error('Wallet provider not found. Please connect your wallet.');
    }

    const result = await executeBlockchainTransaction(
      selectedBlockchain.value,
      walletProvider,
      transactionAmount.value,
      {
        onStatusChange: (status) => {
          currentTransaction.value = { ...status };
        },
        onComplete: (status) => {
          // Add to history
          transactionHistory.value.unshift({ ...status });
          // Keep only last 20 transactions
          if (transactionHistory.value.length > 20) {
            transactionHistory.value = transactionHistory.value.slice(0, 20);
          }
        },
        onError: (error, status) => {
          console.error('Transaction failed:', error);
          currentTransaction.value = { ...status };
        }
      }
    );

    console.log('Transaction completed:', result);

  } catch (error) {
    console.error('Transaction execution failed:', error);
    // Show error in UI
    if (currentTransaction.value) {
      currentTransaction.value.error = error.message;
      currentTransaction.value.status = TRANSACTION_STATUS.FAILED;
    }
  } finally {
    isExecuting.value = false;
  }
}

function getAmountPlaceholder() {
  const symbol = getCurrencySymbol();
  return `Enter amount in ${symbol}`;
}

function getCurrencySymbol() {
  const blockchain = blockchains.value.find(b => b.id === selectedBlockchain.value);
  return blockchain ? blockchain.symbol : '';
}

function getSymbolForChain(chainType) {
  const blockchain = blockchains.value.find(b => b.id === chainType);
  return blockchain ? blockchain.symbol : chainType.toUpperCase();
}

function getExplorerLink(txHash) {
  const blockchain = blockchains.value.find(b => b.id === selectedBlockchain.value);
  return blockchain ? blockchain.explorer + txHash : '#';
}

function getExplorerLinkForChain(chainType, txHash) {
  const blockchain = blockchains.value.find(b => b.id === chainType);
  return blockchain ? blockchain.explorer + txHash : '#';
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString();
}

function formatLogDetails(log) {
  const details = [];
  if (log.chainType) details.push(`Chain: ${log.chainType}`);
  if (log.amount) details.push(`Amount: ${log.amount}`);
  if (log.txHash) details.push(`Hash: ${log.txHash.substring(0, 10)}...`);
  if (log.duration) details.push(`Duration: ${log.duration}ms`);
  return details.join(' | ');
}

function toggleLogs() {
  showLogs.value = !showLogs.value;
}

function updateLogs() {
  transactionLogs.value = transactionLogger.getLogs();
}

// Watchers
watch(() => crypto_selected.value, (newChain) => {
  selectedBlockchain.value = newChain;
});

// Lifecycle
onMounted(() => {
  // Set initial blockchain selection
  if (crypto_selected.value) {
    selectedBlockchain.value = crypto_selected.value;
  }
  
  // Update logs periodically
  setInterval(updateLogs, 1000);
  updateLogs();
});
</script>

<style scoped>
.transaction-interface {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  color: #00ff41;
  font-family: 'Courier New', monospace;
}

.transaction-header {
  text-align: center;
  margin-bottom: 40px;
}

.page-title {
  font-size: 2.5rem;
  font-weight: bold;
  text-shadow: 0 0 10px #00ff41;
  margin-bottom: 10px;
}

.page-subtitle {
  font-size: 1.2rem;
  opacity: 0.8;
  margin: 0;
}

.transaction-form-container {
  background: rgba(0, 255, 65, 0.1);
  border: 1px solid #00ff41;
  border-radius: 8px;
  padding: 30px;
  margin-bottom: 30px;
}

.blockchain-selector h3 {
  margin-bottom: 20px;
  font-size: 1.4rem;
}

.blockchain-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 15px;
  margin-bottom: 30px;
}

.blockchain-card {
  background: rgba(0, 0, 0, 0.3);
  border: 2px solid #333;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.blockchain-card:hover {
  border-color: #00ff41;
  transform: translateY(-2px);
}

.blockchain-card.active {
  border-color: #00ff41;
  background: rgba(0, 255, 65, 0.1);
  box-shadow: 0 0 15px rgba(0, 255, 65, 0.3);
}

.blockchain-icon {
  font-size: 2rem;
  margin-bottom: 10px;
}

.blockchain-name {
  font-size: 1.1rem;
  font-weight: bold;
  margin-bottom: 5px;
}

.blockchain-status {
  font-size: 0.9rem;
  padding: 4px 8px;
  border-radius: 12px;
  text-transform: uppercase;
}

.blockchain-status.ready {
  background: rgba(0, 255, 0, 0.2);
  color: #00ff00;
}

.blockchain-status.disconnected {
  background: rgba(255, 255, 0, 0.2);
  color: #ffff00;
}

.transaction-form {
  border-top: 1px solid #333;
  padding-top: 20px;
}

.form-group {
  position: relative;
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
}

.amount-input {
  width: 100%;
  padding: 12px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid #333;
  border-radius: 4px;
  color: #00ff41;
  font-size: 1.1rem;
  font-family: 'Courier New', monospace;
}

.amount-input:focus {
  outline: none;
  border-color: #00ff41;
  box-shadow: 0 0 10px rgba(0, 255, 65, 0.3);
}

.currency-label {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
  font-weight: bold;
}

.wallet-status {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #333;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 20px;
}

.wallet-info, .balance-info {
  margin-bottom: 5px;
}

.execute-button {
  width: 100%;
  padding: 15px;
  background: linear-gradient(45deg, #00ff41, #00cc33);
  border: none;
  border-radius: 8px;
  color: #000;
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
}

.execute-button:hover:not(:disabled) {
  background: linear-gradient(45deg, #00cc33, #00ff41);
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(0, 255, 65, 0.4);
}

.execute-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.execute-button.loading {
  background: linear-gradient(45deg, #666, #999);
}

.transaction-status {
  margin-bottom: 30px;
}

.status-card {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #333;
  border-radius: 8px;
  padding: 20px;
}

.status-card.pending {
  border-color: #ffff00;
  background: rgba(255, 255, 0, 0.1);
}

.status-card.success {
  border-color: #00ff00;
  background: rgba(0, 255, 0, 0.1);
}

.status-card.failed {
  border-color: #ff0000;
  background: rgba(255, 0, 0, 0.1);
}

.status-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 12px;
  font-weight: bold;
  margin-bottom: 15px;
}

.status-card.pending .status-badge {
  background: #ffff00;
  color: #000;
}

.status-card.success .status-badge {
  background: #00ff00;
  color: #000;
}

.status-card.failed .status-badge {
  background: #ff0000;
  color: #fff;
}

.hash-link {
  color: #00ff41;
  text-decoration: none;
  word-break: break-all;
}

.hash-link:hover {
  text-decoration: underline;
}

.transaction-history, .logs-section {
  margin-bottom: 30px;
}

.transaction-history h3, .logs-section h3 {
  margin-bottom: 15px;
  font-size: 1.4rem;
}

.toggle-logs-btn {
  background: none;
  border: 1px solid #00ff41;
  color: #00ff41;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  margin-left: 10px;
}

.toggle-logs-btn:hover {
  background: rgba(0, 255, 65, 0.1);
}

.history-container, .logs-container {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #333;
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.history-item {
  padding: 15px;
  border-bottom: 1px solid #333;
}

.history-item:last-child {
  border-bottom: none;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.history-blockchain {
  font-weight: bold;
  text-transform: uppercase;
}

.history-status {
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 0.8rem;
  text-transform: uppercase;
}

.history-status.success {
  background: rgba(0, 255, 0, 0.2);
  color: #00ff00;
}

.history-status.failed {
  background: rgba(255, 0, 0, 0.2);
  color: #ff0000;
}

.history-status.pending {
  background: rgba(255, 255, 0, 0.2);
  color: #ffff00;
}

.log-entry {
  display: flex;
  gap: 15px;
  padding: 8px 15px;
  border-bottom: 1px solid #333;
  font-size: 0.9rem;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: #666;
  white-space: nowrap;
}

.log-action {
  font-weight: bold;
  min-width: 120px;
}

.log-details {
  color: #999;
}

.no-history, .no-logs {
  padding: 20px;
  text-align: center;
  color: #666;
  font-style: italic;
}

/* Responsive design */
@media (max-width: 768px) {
  .blockchain-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }
  
  .page-title {
    font-size: 2rem;
  }
  
  .history-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  
  .log-entry {
    flex-direction: column;
    gap: 5px;
  }
}
</style>
