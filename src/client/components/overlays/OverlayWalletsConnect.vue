<template>


  <div class="overlay wallets-connect">
    <p class="connect-wallet-text">Connect your wallet to play!</p>
    <button class="close-button" @click="$emit('close_overlay')">&times;</button>
    <div class="scrollable-content">
      <div class="grid-container">

        <h2 class="item-label cyberpunk glitched solana">SOLANA</h2>
        <button class="button-connect solana phantom" @click="selectWallet('solana', 'phantom', $event)">
          <img v-lazy="'/wallet_icons/phantom.png'">
          <h2 class="item-label cyberpunk glitched solana">PHANTOM</h2><img v-lazy="'/crypto_icons/solana.png'">
        </button>
        <button class="button-connect solana solflare" @click="selectWallet('solana', 'solflare', $event)">
          <img v-lazy="'/wallet_icons/solflare.png'">
          <h2 class="item-label cyberpunk glitched solana">SOLFLARE</h2><img v-lazy="'/crypto_icons/solana.png'">
        </button>
        <button class="button-connect solana mathwallet" @click="selectWallet('solana', 'mathwallet', $event)">
          <img v-lazy="'/wallet_icons/mathwallet.png'">
          <h2 class="item-label cyberpunk glitched solana">MATHWALLET</h2><img
            v-lazy="'/crypto_icons/solana.png'">
        </button>
        <button class="button-connect solana coin98" @click="selectWallet('solana', 'coin98', $event)">
          <img v-lazy="'/wallet_icons/coin98.png'">
          <h2 class="item-label cyberpunk glitched solana">COIN98</h2><img v-lazy="'/crypto_icons/solana.png'">
        </button>
        <button class="button-connect exodus solana" @click="selectWallet('solana', 'exodus', $event)">
          <img alt="Exodus crypto wallet logo web3" v-lazy="'/wallet_icons/exodus.png'">
          <h2 class="item-label cyberpunk glitched solana">EXODUS</h2>
          <img alt="Solana icon" v-lazy="'/crypto_icons/solana.png'">
        </button>
        <button class="button-connect trust solana" @click="selectWallet('solana', 'trust', $event)">
          <img alt="Trust crypto wallet logo web3" v-lazy="'/wallet_icons/trust.png'">
          <h2 class="item-label cyberpunk glitched solana">TRUST</h2>
          <img alt="Solana icon" v-lazy="'/crypto_icons/solana.png'">
        </button>
        <div class="divider"></div>

        <h2 class="item-label cyberpunk glitched aptos">APTOS</h2>
        <button class="button-connect martian aptos" @click="selectWallet('aptos', 'martian', $event)">
          <img alt="Martian crypto wallet logo web3" v-lazy="'/wallet_icons/martian.png'">
          <h2 class="item-label cyberpunk glitched aptos">MARTIAN</h2>
          <img alt="Aptos icon" v-lazy="'/crypto_icons/aptos.png'">
        </button>
        <button class="button-connect petra aptos" @click="selectWallet('aptos', 'petra', $event)">
          <img alt="Petra crypto wallet logo web3" v-lazy="'/wallet_icons/petra.png'">
          <h2 class="item-label cyberpunk glitched aptos">PETRA</h2>
          <img alt="Aptos icon" v-lazy="'/crypto_icons/aptos.png'">
        </button>
        <button class="button-connect pontem aptos" @click="selectWallet('aptos', 'pontem', $event)">
          <img alt="Pontem crypto wallet logo web3" v-lazy="'/wallet_icons/pontem.png'">
          <h2 class="item-label cyberpunk glitched aptos">PONTEM</h2>
          <img alt="Aptos icon" v-lazy="'/crypto_icons/aptos.png'">
        </button>
        <button class="button-connect rise aptos" @click="selectWallet('aptos', 'rise', $event)">
          <img alt="Rise crypto wallet logo web3" v-lazy="'/wallet_icons/rise.png'">
          <h2 class="item-label cyberpunk glitched aptos">RISE</h2>
          <img alt="Aptos icon" v-lazy="'/crypto_icons/aptos.png'">
        </button>
        <div class="divider"></div>

        <h2 class="item-label cyberpunk glitched ethereum">ETHEREUM</h2>
        <button class="button-connect ethereum coinbase" @click="selectWallet('ethereum', 'coinbase')">
          <img alt="Coinbase crypto wallet logo web3" v-lazy="'/wallet_icons/coinbase.png'">
          <h2 class="item-label cyberpunk glitched ethereum">COINBASE</h2>
          <img alt="Ethereum icon" v-lazy="'/crypto_icons/ethereum.png'">
        </button>
        <button class="button-connect ethereum metamask" @click="selectWallet('ethereum', 'metamask')">
          <img alt="Metamask crypto wallet logo web3" v-lazy="'/wallet_icons/metamask.png'">
          <h2 class="item-label cyberpunk glitched ethereum">METAMASK</h2>
          <img alt="Ethereum icon" v-lazy="'/crypto_icons/ethereum.png'">
        </button>
        <button class="button-connect ethereum trust" @click="selectWallet('ethereum', 'trust')">
          <img alt="Trust crypto wallet logo web3" v-lazy="'/wallet_icons/trust.png'">
          <h2 class="item-label cyberpunk glitched ethereum">TRUST</h2>
          <img alt="Ethereum icon" v-lazy="'/crypto_icons/ethereum.png'">
        </button>
        <button class="button-connect ethereum exodus" @click="selectWallet('ethereum', 'exodus')">
          <img alt="Exodus crypto wallet logo web3" v-lazy="'/wallet_icons/exodus.png'">
          <h2 class="item-label cyberpunk glitched ethereum">EXODUS</h2>
          <img alt="Ethereum icon" v-lazy="'/crypto_icons/ethereum.png'">
        </button>
        <button class="button-connect ethereum enkrypt" @click="selectWallet('ethereum', 'enkrypt')">
          <img alt="Enkrypt crypto wallet logo web3" v-lazy="'/wallet_icons/enkrypt.png'">
          <h2 class="item-label cyberpunk glitched ethereum">ENKRYPT</h2>
          <img alt="Ethereum icon" v-lazy="'/crypto_icons/ethereum.png'">
        </button>
        <button class="button-connect ethereum phantom" @click="selectWallet('ethereum', 'phantom')">
          <img alt="Phantom crypto wallet logo web3" v-lazy="'/wallet_icons/phantom.png'">
          <h2 class="item-label cyberpunk glitched ethereum">PHANTOM</h2>
          <img alt="Ethereum icon" v-lazy="'/crypto_icons/ethereum.png'">
        </button>
        <div class="divider"></div>

        <h2 class="item-label cyberpunk glitched bitcoin">BITCOIN</h2>
        <button class="button-connect bitcoin xverse" @click="selectWallet('bitcoin', 'xverse', $event)">
          <img alt="Wallet Connect crypto wallet logo web3" v-lazy="'/wallet_icons/xverse.png'">
          <h2 class="item-label cyberpunk glitched bitcoin">XVERSE</h2>
          <img alt="Bitcoin icon" v-lazy="'/crypto_icons/bitcoin.png'">
        </button>
        <button class="button-connect bitcoin unisat" @click="selectWallet('bitcoin', 'unisat', $event)">
          <img alt="Exodus crypto wallet logo web3" v-lazy="'/wallet_icons/unisat.png'">
          <h2 class="item-label cyberpunk glitched bitcoin">UNISAT</h2>
          <img alt="Bitcoin icon" v-lazy="'/crypto_icons/bitcoin.png'">
        </button>
        <button class="button-connect bitcoin leather" @click="selectWallet('bitcoin', 'leather', $event)">
          <img alt="Trust crypto wallet logo web3" v-lazy="'/wallet_icons/leather.png'">
          <h2 class="item-label cyberpunk glitched bitcoin">LEATHER</h2>
          <img alt="Bitcoin icon" v-lazy="'/crypto_icons/bitcoin.png'">
        </button>
        <!-- <button class="button-connect bitcoin coin98" @click="selectWallet('bitcoin', 'coin98', $event)">
          <img alt="Coin98 crypto wallet logo web3" v-lazy="'/wallet_icons/coin98.png'">
          <h2 class="item-label cyberpunk glitched bitcoin">COIN98</h2>
          <img alt="Bitcoin icon" v-lazy="'/crypto_icons/bitcoin.png'">
        </button> -->
        <div class="divider"></div>

        <h2 class="item-label cyberpunk glitched cardano">CARDANO</h2>
        <button class="button-connect cardano lace" @click="selectWallet('cardano', 'lace', $event)">
          <img alt="Lace crypto wallet logo web3" v-lazy="'/wallet_icons/lace.png'">
          <h2 class="item-label cyberpunk glitched cardano">LACE</h2>
          <img alt="Cardano icon" v-lazy="'/crypto_icons/cardano.png'">
        </button>
        <button class="button-connect cardano eternl" @click="selectWallet('cardano', 'eternl', $event)">
          <img alt="Eternl crypto wallet logo web3" v-lazy="'/wallet_icons/eternl.png'">
          <h2 class="item-label cyberpunk glitched cardano">ETERNL</h2>
          <img alt="Cardano icon" v-lazy="'/crypto_icons/cardano.png'">
        </button>
        <button class="button-connect cardano yoroi" @click="selectWallet('cardano', 'yoroi', $event)">
          <img alt="Yoroi crypto wallet logo web3" v-lazy="'/wallet_icons/yoroi.png'">
          <h2 class="item-label cyberpunk glitched cardano">YOROI</h2>
          <img alt="Cardano icon" v-lazy="'/crypto_icons/cardano.png'">
        </button>
        <button class="button-connect cardano typhon" @click="selectWallet('cardano', 'typhon', $event)">
          <img alt="Typhon crypto wallet logo web3" v-lazy="'/wallet_icons/typhon.png'">
          <h2 class="item-label cyberpunk glitched cardano">TYPHON</h2>
          <img alt="Cardano icon" v-lazy="'/crypto_icons/cardano.png'">
        </button>
        <div class="divider"></div>

                <h2 class="item-label cyberpunk glitched sui">SUI</h2>
        <button class="button-connect sui suiet" @click="selectWallet('sui', 'suiet', $event)">
          <img alt="Suiet crypto wallet logo web3" v-lazy="'/wallet_icons/suiet.png'">
          <h2 class="item-label cyberpunk glitched sui">SUIET</h2>
          <img alt="Sui icon" v-lazy="'/crypto_icons/sui.png'">
        </button>
        <button class="button-connect sui slush" @click="selectWallet('sui', 'slush', $event)">
          <img alt="Slush crypto wallet logo web3" v-lazy="'/wallet_icons/slush.png'">
          <h2 class="item-label cyberpunk glitched sui">SLUSH</h2>
          <img alt="Sui icon" v-lazy="'/crypto_icons/sui.png'">
        </button>
        <button class="button-connect sui nightly" @click="selectWallet('sui', 'nightly', $event)">
          <img alt="Nightly crypto wallet logo web3" v-lazy="'/wallet_icons/nightly.png'">
          <h2 class="item-label cyberpunk glitched sui">NIGHTLY</h2>
          <img alt="Sui icon" v-lazy="'/crypto_icons/sui.png'">
        </button>
        <button class="button-connect sui backpack" @click="selectWallet('sui', 'backpack', $event)">
          <img alt="Backpack crypto wallet logo web3" v-lazy="'/wallet_icons/backpack.png'">
          <h2 class="item-label cyberpunk glitched sui">BACKPACK</h2>
          <img alt="Sui icon" v-lazy="'/crypto_icons/sui.png'">
        </button>
        <button class="button-connect sui phantom" @click="selectWallet('sui', 'phantom', $event)">
          <img alt="Phantom crypto wallet logo web3" v-lazy="'/wallet_icons/phantom.png'">
          <h2 class="item-label cyberpunk glitched sui">PHANTOM</h2>
          <img alt="Sui icon" v-lazy="'/crypto_icons/sui.png'">
        </button>
        <button class="button-connect sui martian" @click="selectWallet('sui', 'martian', $event)">
          <img alt="Martian crypto wallet logo web3" v-lazy="'/wallet_icons/martian.png'">
          <h2 class="item-label cyberpunk glitched sui">MARTIAN</h2>
          <img alt="Sui icon" v-lazy="'/crypto_icons/sui.png'">
        </button>
        <button class="button-connect sui surf" @click="selectWallet('sui', 'surf', $event)">
          <img alt="Surf crypto wallet logo web3" v-lazy="'/wallet_icons/surf.png'">
          <h2 class="item-label cyberpunk glitched sui">SURF</h2>
          <img alt="Sui icon" v-lazy="'/crypto_icons/sui.png'">
        </button>
        <button class="button-connect sui glass" @click="selectWallet('sui', 'glass', $event)">
          <img alt="Glass crypto wallet logo web3" v-lazy="'/wallet_icons/glass.png'">
          <h2 class="item-label cyberpunk glitched sui">GLASS</h2>
          <img alt="Sui icon" v-lazy="'/crypto_icons/sui.png'">
        </button>
        <template v-for="(adapter, walletName) in suiButtons" :key="walletName">
          <button class="button-connect sui" :class="walletName" @click="selectWallet('sui', walletName, $event)">
            <img :alt="`${adapter.name} crypto wallet logo web3`" :src="adapter.icon">
            <h2 class="item-label cyberpunk glitched sui">{{ walletName.toUpperCase() }}</h2>
            <img alt="Sui icon" v-lazy="'/crypto_icons/sui.png'">
          </button>
        </template>
        <div class="divider"></div>

      </div>
    </div>
  </div>


</template>


<script>


import { updateSuiWalletsAvailable, selectWalletSui, disconnectWalletSui } from "../../scripts/chains/sui.js";
import { updateSolanaWalletsAvailable, selectWalletSolana, disconnectWalletSolana } from "../../scripts/chains/solana.js";
import { updateAptosWalletsAvailable, selectWalletAptos, disconnectWalletAptos } from "../../scripts/chains/aptos.js";
import { updateEthereumWalletsAvailable, selectWalletEthereum, disconnectWalletEthereum } from "../../scripts/chains/ethereum.js";
import { updateBitcoinWalletsAvailable, selectWalletBitcoin, disconnectWalletBitcoin } from "../../scripts/chains/bitcoin.js";
import { updateCardanoWalletsAvailable, selectWalletCardano, disconnectWalletCardano } from "../../scripts/chains/cardano.js";
import { authChecker } from "../../scripts/authenticationChecker.js";

import { onFrontendLogout } from "../../scripts/chains/shared.js";
import { useGlobalStore } from '@/client/stores/global';
import { storeToRefs } from 'pinia';
import { computed, nextTick } from 'vue';
import axios from 'axios';
import { useSuiNewWalletStore } from '@/client/scripts/chains/sui';

export default {  
	name: "OverlayWalletsConnect",
	setup(){
    const store = useGlobalStore();
    const { navigation_state_overlay } = storeToRefs(store);
    const suiWalletStore = useSuiNewWalletStore();
    const { suiButtons } = storeToRefs(suiWalletStore);

    // nextTick(() => {
    //   updateSuiWalletsAvailable();
    // });

		return {
      navigation_state_overlay,
      walletIcons: import.meta.glob("./wallet_icons/*.png", { eager: false }),
      cryptoIcons: import.meta.glob("./crypto_icons/*.png", { eager: false }),
      suiButtons
		};
	},	mounted() {
    // Check if user already has a valid session
    this.checkExistingSession();

    updateSolanaWalletsAvailable();
    updateAptosWalletsAvailable();
    updateEthereumWalletsAvailable();
    updateBitcoinWalletsAvailable();
    updateCardanoWalletsAvailable();
    updateSuiWalletsAvailable();

    const setRandomAnimationDelay = () => {
      const headers = document.querySelectorAll('h2.cyberpunk.glitched');
      headers.forEach(h2 => {
        const delay = (Math.random() * 3).toFixed(2) + 's';
        h2.style.animationDelay = delay;
      });
    };
    nextTick(setRandomAnimationDelay);
  },

  created() {
    // Check session on component creation
    this.checkExistingSession();
	},
	methods: {

    checkExistingSession() {
      // Check if user has a valid authentication session
      if (authChecker.shouldSkipAuthentication()) {
        const authStatus = authChecker.getAuthenticationStatus();
        console.log('[WALLET_CONNECT] Found existing session:', authStatus);

        // If session exists, close the overlay and use existing authentication
        if (authStatus.isAuthenticated) {
          this.$emit('close_overlay');
          console.log('[WALLET_CONNECT] Using existing session, skipping wallet connection');
          return true;
        }
      }
      return false;
    },

		selectWallet(crypto, wallet) {

      this.disconnectWallets();

      const store = useGlobalStore();
      const { crypto_selected, wallet_selected, walletIconPath, cryptoIconPath } = storeToRefs(store);

      // Update global store values
      crypto_selected.value = crypto;
      wallet_selected.value = wallet;

      walletIconPath.value = computed(() => {
        return `../../wallet_icons/${wallet_selected.value}.png`;
      });
      cryptoIconPath.value = computed(() => {
        return `../../crypto_icons/${crypto_selected.value}.png`;
      });

      switch (crypto) {
        case 'solana': {
          selectWalletSolana(wallet);
          this.$emit('close_overlay')
          break;
        }
        case 'aptos': {
          selectWalletAptos(wallet);
          this.$emit('close_overlay')
          break;
        }
        case 'ethereum': {
          selectWalletEthereum(wallet);
          this.$emit('close_overlay')
          break;
        }
        case 'bitcoin': {
          selectWalletBitcoin(wallet);
          this.$emit('close_overlay')
          break;
        }
        case 'cardano': {
          selectWalletCardano(wallet);
          this.$emit('close_overlay')
          break;
        }
        case 'sui': {
          selectWalletSui(wallet);
          this.$emit('close_overlay')
          break;
        }
        case 'dogecoin': {
          selectWalletDogecoin(wallet);
          this.$emit('close_overlay')
          break;
        }
        case 'xrp': {
          selectWalletXrp(wallet);
          this.$emit('close_overlay')
          break;
        }
        case 'binance': {
          selectWalletBinance(wallet);
          this.$emit('close_overlay')
          break;
        }
        case 'litecoin': {
          selectWalletLitecoin(wallet);
          this.$emit('close_overlay')
          break;
        }
        default:
          console.warn(`Unhandled crypto type: ${crypto}`);
      }

    },

		disconnectWallets() {
      const store = useGlobalStore();
      const { is_authenticated } = storeToRefs(store);
      if (is_authenticated && is_authenticated.value) {
        axios.post('/api/logout').catch(e => {
          console.warn('[FRONTEND] /api/logout failed:', e);        }).finally(() => {
          onFrontendLogout();
          disconnectWalletSolana();
          disconnectWalletAptos();
          disconnectWalletEthereum();
          disconnectWalletBitcoin();
          disconnectWalletCardano();
          disconnectWalletSui();
        });
      } else {
        onFrontendLogout();
        disconnectWalletSolana();
        disconnectWalletAptos();
        disconnectWalletEthereum();
        disconnectWalletBitcoin();
        disconnectWalletCardano();
        disconnectWalletSui();
      }
    },

	},
	emits: ["close_overlay"]
};

	
</script>


<style scoped>


.overlay.wallets-connect {
  padding: 3vmin;
  margin: 3vmin;
  height: calc(94vmin - 96px);
  align-items: start;
  gap: 20px;
  flex-direction: row;
  flex-wrap: wrap;
}

.close-button {
    position: absolute;
    top: -2vmin;
    font-size: 8vmin !important;
    right: 2vmin !important;
    color: var(--neon-pink);
    padding-right: 10px;
    padding-top: 10px;
}

.connect-wallet-text {
  grid-row: 1;
  grid-column: 1;
  font-size: 1.2em;
  color: #fff;
  align-self: center;
  padding-left: 20px;
}

.scrollable-content {
  grid-row: 2;
  overflow-y: auto;
  border-radius: 8px; /* Example border radius */
  width: 100% !important;
  height: 90%;
  overflow-x: hidden;
  scroll-snap-type: y mandatory;
}

.grid-container {
  width:100%;
  gap: 16px; /* Space between grid items */
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  align-content: center;
  justify-content: center;
}

.grid-item {
  padding: 16px;
  text-align: center;
  scroll-snap-align: start;
}

/*//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////*/

.games-container {
  position: relative;
}

.grid-container > h2 {
  padding-left: 20px;;
}

h2.item-label {
  color: var(--cyber-yellow);
}

h2.cyberpunk::after {
    content: "_";
    animation-name: hxafter;
    animation-duration: var(--glitched-duration);
    animation-iteration-count: infinite;
    animation-timing-function: linear;
}

h2.cyberpunk.glitched:not([disabled]), h2.glitched:not([disabled]) {
    animation-name: h1glitched;
    animation-duration: calc(var(--glitched-duration) * 1.7);
    animation-iteration-count: infinite;
    animation-direction: reverse;
    animation-timing-function: linear;
}

/* div>h2.cyberpunk.glitched.bitcoin:not([disabled]), div>h2.cyberpunk.bitcoin::after{  animation-delay: 0.5s; }
div>h2.cyberpunk.glitched.solana:not([disabled]), div>h2.glitched.solana::after{  animation-delay: 0.3s; }
div>h2.cyberpunk.glitched.sui:not([disabled]), div>h2.glitched.sui::after{  animation-delay: 1.6s; }
div>h2.cyberpunk.glitched.aptos:not([disabled]), div>h2.glitched.aptos::after{  animation-delay: 2.7s; }
div>h2.cyberpunk.glitched.cardano:not([disabled]), div>h2.glitched.cardano::after{  animation-delay: 0.8s; }
div>h2.cyberpunk.glitched.ethereum:not([disabled]), div>h2.glitched.ethereum::after{  animation-delay: 1.2s; }

button.button-connect.bitcoin:nth-of-type(1)>h2,
button.button-connect.ethereum:nth-of-type(1)>h2,
button.button-connect.solana:nth-of-type(1)>h2,
button.button-connect.sui:nth-of-type(1)>h2,
button.button-connect.aptos:nth-of-type(1)>h2,
button.button-connect.cardano:nth-of-type(1)>h2 { animation-delay: 0.2s !important; }

button.button-connect.bitcoin:nth-of-type(2)>h2,
button.button-connect.ethereum:nth-of-type(2)>h2,
button.button-connect.solana:nth-of-type(2)>h2,
button.button-connect.sui:nth-of-type(2)>h2,
button.button-connect.aptos:nth-of-type(2)>h2,
button.button-connect.cardano:nth-of-type(2)>h2 { animation-delay: 1.7s !important; }

button.button-connect.bitcoin:nth-of-type(3)>h2,
button.button-connect.ethereum:nth-of-type(3)>h2,
button.button-connect.solana:nth-of-type(3)>h2,
button.button-connect.sui:nth-of-type(3)>h2,
button.button-connect.aptos:nth-of-type(3)>h2,
button.button-connect.cardano:nth-of-type(3)>h2 { animation-delay: 0.4s !important; }

button.button-connect.bitcoin:nth-of-type(4)>h2,
button.button-connect.ethereum:nth-of-type(4)>h2,
button.button-connect.solana:nth-of-type(4)>h2,
button.button-connect.sui:nth-of-type(4)>h2,
button.button-connect.aptos:nth-of-type(4)>h2,
button.button-connect.cardano:nth-of-type(4)>h2 { animation-delay: 1.9s !important; }

button.button-connect.bitcoin:nth-of-type(5)>h2,
button.button-connect.ethereum:nth-of-type(5)>h2,
button.button-connect.solana:nth-of-type(5)>h2,
button.button-connect.sui:nth-of-type(5)>h2,
button.button-connect.aptos:nth-of-type(5)>h2,
button.button-connect.cardano:nth-of-type(5)>h2 { animation-delay: 0.6s !important; }

button.button-connect.bitcoin:nth-of-type(6)>h2,
button.button-connect.ethereum:nth-of-type(6)>h2,
button.button-connect.solana:nth-of-type(6)>h2,
button.button-connect.sui:nth-of-type(6)>h2,
button.button-connect.aptos:nth-of-type(6)>h2,
button.button-connect.cardano:nth-of-type(6)>h2 { animation-delay: 2.1s !important; }

button.button-connect.bitcoin:nth-of-type(7)>h2,
button.button-connect.ethereum:nth-of-type(7)>h2,
button.button-connect.solana:nth-of-type(7)>h2,
button.button-connect.sui:nth-of-type(7)>h2,
button.button-connect.aptos:nth-of-type(7)>h2,
button.button-connect.cardano:nth-of-type(7)>h2 { animation-delay: 0.8s !important; }

button.button-connect.bitcoin:nth-of-type(8)>h2,
button.button-connect.ethereum:nth-of-type(8)>h2,
button.button-connect.solana:nth-of-type(8)>h2,
button.button-connect.sui:nth-of-type(8)>h2,
button.button-connect.aptos:nth-of-type(8)>h2,
button.button-connect.cardano:nth-of-type(8)>h2 { animation-delay: 2.3s !important; }

button.button-connect.bitcoin:nth-of-type(9)>h2,
button.button-connect.ethereum:nth-of-type(9)>h2,
button.button-connect.solana:nth-of-type(9)>h2,
button.button-connect.sui:nth-of-type(9)>h2,
button.button-connect.aptos:nth-of-type(9)>h2,
button.button-connect.cardano:nth-of-type(9)>h2 { animation-delay: 1.0s !important; }

button.button-connect.bitcoin:nth-of-type(10)>h2,
button.button-connect.ethereum:nth-of-type(10)>h2,
button.button-connect.solana:nth-of-type(10)>h2,
button.button-connect.sui:nth-of-type(10)>h2,
button.button-connect.aptos:nth-of-type(10)>h2,
button.button-connect.cardano:nth-of-type(10)>h2 { animation-delay: 2.5s !important; }

button.button-connect.bitcoin:nth-of-type(11)>h2,
button.button-connect.ethereum:nth-of-type(11)>h2,
button.button-connect.solana:nth-of-type(11)>h2,
button.button-connect.sui:nth-of-type(11)>h2,
button.button-connect.aptos:nth-of-type(11)>h2,
button.button-connect.cardano:nth-of-type(11)>h2 { animation-delay: 1.2s !important; }

button.button-connect.bitcoin:nth-of-type(12)>h2,
button.button-connect.ethereum:nth-of-type(12)>h2,
button.button-connect.solana:nth-of-type(12)>h2,
button.button-connect.sui:nth-of-type(12)>h2,
button.button-connect.aptos:nth-of-type(12)>h2,
button.button-connect.cardano:nth-of-type(12)>h2 { animation-delay: 2.7s !important; }

button.button-connect.bitcoin:nth-of-type(13)>h2,
button.button-connect.ethereum:nth-of-type(13)>h2,
button.button-connect.solana:nth-of-type(13)>h2,
button.button-connect.sui:nth-of-type(13)>h2,
button.button-connect.aptos:nth-of-type(13)>h2,
button.button-connect.cardano:nth-of-type(13)>h2 { animation-delay: 1.4s !important; }

button.button-connect.bitcoin:nth-of-type(14)>h2,
button.button-connect.ethereum:nth-of-type(14)>h2,
button.button-connect.solana:nth-of-type(14)>h2,
button.button-connect.sui:nth-of-type(14)>h2,
button.button-connect.aptos:nth-of-type(14)>h2,
button.button-connect.cardano:nth-of-type(14)>h2 { animation-delay: 2.9s !important; }

button.button-connect.bitcoin:nth-of-type(15)>h2,
button.button-connect.ethereum:nth-of-type(15)>h2,
button.button-connect.solana:nth-of-type(15)>h2,
button.button-connect.sui:nth-of-type(15)>h2,
button.button-connect.aptos:nth-of-type(15)>h2,
button.button-connect.cardano:nth-of-type(15)>h2 { animation-delay: 1.6s !important; } */



.divider {
    width: 90%;
    position: relative;
    margin: auto;
    margin-bottom: 9px;
}

.divider::before {
    content: " ";
    display: block;
    position: absolute;
    width: 100%;
    height: 10px;
    background-color: var(--neon-pink);
    clip-path: polygon(0px 5px, 35px 5px, 40px 0px, 85px 0px, 90px 5px, 100% 5px, 100% 6px, 85px 6px, 80px 10px, 20px 10px, 15px 6px, 0px 6px);
}

@keyframes h1glitched {
  0% {
    transform: skew(-20deg);
    left: -4px;
}
10% {
    transform: skew(-20deg);
    left: -4px;
}
11% {
    transform: skew(0deg);
    left: 2px;
}
50% {
    transform: skew(0deg);
}
51% {
    transform: skew(10deg);
}
59% {
    transform: skew(10deg);
}
60% {
    transform: skew(0deg);
}
100% {
    transform: skew(0deg);
}
}

@keyframes h2beforeglitched {
  0% {
    transform: scaleY(1);
}

10% {
    transform: scaleY(1);
}
11% {
    transform: scaleY(-1);
}
50% {
    transform: scaleY(-1);
}
51% {
    transform: scaleY(1);
}
59% {
    transform: scaleY(1);
}
60% {
    transform: scaleY(1);
}
100% {
    transform: scaleY(1);
}
}

@keyframes hxafter {
  0% {
    opacity: 0;
}

50% {
    opacity: 0;
}
51% {
    opacity: 1;
}
100% {
    opacity: 1;
}
}

button.button-connect {
  display: inline-block;
  padding: 8px 20px;
  border: 1px solid var(--neon-blue);
  color: var(--neon-blue);
  text-decoration: none;
  text-transform: uppercase;
  font-family: "Orbitron", sans-serif;
  font-size: 0.8rem;
  font-weight: bold;
  letter-spacing: 1px;
  background: transparent;
  position: relative;
  overflow: hidden;
  transition: all 0.3s;
  align-self: flex-start;
}

button.button-connect {
	display: flex !important;
    flex-direction: row;
    flex-wrap: nowrap;
    align-content: center;
    justify-content: space-between;
    align-items: center;
    width: 90%;
}

button.button-connect:hover h2.cyberpunk.glitched {
  color: #fff !important;
}

button.button-connect:not([disabled])::before {
  content: "";
  position: absolute;
  top: 0;
  top: 0;
  width: 100%;
  left: -100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(5, 217, 232, 0.4), transparent);
  transition: left 0.3s;
}

button.button-connect:not([disabled]):hover {
  background-color: rgba(5, 217, 232, 0.2);
  box-shadow: 0 0 10px rgba(5, 217, 232, 0.5);
  color: white;
}

button.button-connect {
  margin: auto;
  display: inline-block;
  padding: 8px 20px;
  border: 1px solid var(--neon-blue);
  color: var(--neon-blue);
  text-decoration: none;
  text-transform: uppercase;
  font-family: "Orbitron", sans-serif;
  font-size: 0.8rem;
  font-weight: bold;
  letter-spacing: 1px;
  background: transparent;
  position: relative;
  overflow: hidden;
  transition: all 0.3s;
  align-self: flex-start;
}

button.button-connect:not([disabled])::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(5, 217, 232, 0.4), transparent);
  transition: left 0.3s;
}

button.button-connect:not([disabled]):hover::before {
  left: 100%;
  transition: left 0.5s ease;
}

button.button-connect > img {
    height: 24px;
}


</style>
