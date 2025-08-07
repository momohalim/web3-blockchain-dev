<template>
  <div class="page">

    <div class="overlay">

      <div class="crypto-container-scroll">
        <div class="crypto-container">
          <div v-for="crypto in cryptos" :key="crypto.id" class="crypto-item">
            <p>1$ = {{ crypto.valueInCrypto }} {{ crypto.symbol.toUpperCase() }}</p>
            <p>20$ = {{ crypto.valueInCrypto*20 }} {{ crypto.symbol.toUpperCase() }}</p>
            <p>100$ = {{ crypto.valueInCrypto*100 }} {{ crypto.symbol.toUpperCase() }}</p>
            <p>1000$ = {{ crypto.valueInCrypto*1000 }} {{ crypto.symbol.toUpperCase() }}</p>
            <p>10000$ = {{ crypto.valueInCrypto*10000 }} {{ crypto.symbol.toUpperCase() }}</p>
            <p>100000$ = {{ crypto.valueInCrypto*100000 }} {{ crypto.symbol.toUpperCase() }}</p>
          </div>
        </div>
      </div>

      <button class="button-start-transaction">START TRANSACTION</button>
      <span class="transaction-status">transaction not started yet</span>

    </div>
  </div>
</template>

<script>
import axios from 'axios';
import { useGlobalStore } from '@/client/stores/global';
import { storeToRefs } from 'pinia';


export default {
  name: 'PageShop',
  data() {
    return {
      cryptos: [
        { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', valueInUSD: 0, valueInCrypto: 0 },
        { id: 'ethereum', symbol: 'eth', name: 'Ethereum', valueInUSD: 0, valueInCrypto: 0 },
        { id: 'solana', symbol: 'sol', name: 'Solana', valueInUSD: 0, valueInCrypto: 0 },
        { id: 'cardano', symbol: 'ada', name: 'Cardano', valueInUSD: 0, valueInCrypto: 0 },
        { id: 'aptos', symbol: 'apt', name: 'Aptos', valueInUSD: 0, valueInCrypto: 0 },
        { id: 'sui', symbol: 'sui', name: 'Sui', valueInUSD: 0, valueInCrypto: 0 },
        { id: 'binancecoin', symbol: 'bnb', name: 'Binance Coin', valueInUSD: 0, valueInCrypto: 0 },
        { id: 'dogecoin', symbol: 'doge', name: 'Dogecoin', valueInUSD: 0, valueInCrypto: 0 },
        { id: 'litecoin', symbol: 'ltc', name: 'Litecoin', valueInUSD: 0, valueInCrypto: 0 },
        { id: 'ripple', symbol: 'xrp', name: 'XRP', valueInUSD: 0, valueInCrypto: 0 }
      ],
      intervalId: null
    };
  },
  methods: {
    async fetchCryptoData() {
      try {
        const cryptoIds = this.cryptos.map(crypto => crypto.id).join(',');
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds}&vs_currencies=usd`);
        const data = response.data;

        // Update the cryptos array with current prices
        this.cryptos.forEach(crypto => {
          if (data[crypto.id]) {
            crypto.valueInUSD = data[crypto.id].usd;
            crypto.valueInCrypto = 1 / data[crypto.id].usd; // Calculate how much crypto equals 1 USD
          }
        });

        console.log('Updated crypto prices:', this.cryptos);
      } catch (error) {
        console.error('Error fetching crypto data:', error);
      }
    },
    startPriceUpdates() {
      // Fetch prices immediately
      this.fetchCryptoData();
      // Then fetch every 30 seconds
      this.intervalId = setInterval(() => {
        this.fetchCryptoData();
      }, 30000);
    },
    stopPriceUpdates() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
  },
  mounted() {
    this.startPriceUpdates();
  },
  beforeUnmount() {
    this.stopPriceUpdates();
  },
};


</script>

<style scoped>
.page {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-content: flex-start;
    align-items: flex-start;
    justify-content: center;
    position: fixed;
    height: calc(100% - 96px) !important;
    width: 100vw !important;
}

button.button-start-transaction {
    padding: 10px 20px;
    background-color: #F0F;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
}

.overlay {
    position: fixed;
    width: 100%;
    height: 100%;
    max-width: 100%;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.crypto-container-scroll {
    position: relative;
    font-size: 0.75rem;
    height: 50%;
    width: 50%;
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-content: flex-start;
    justify-content: flex-start;
    overflow-y: auto;
}

.crypto-item {
    padding: 0.25rem;
}

.crypto-item p {
    margin: 0;
}

.crypto-item :nth-child(1) {
    color: var(--cyber-green);
}

.crypto-item :nth-child(2),
.crypto-item :nth-child(3),
.crypto-item :nth-child(4),
.crypto-item :nth-child(5),
.crypto-item :nth-child(6) {
    color: var(--cyber-yellow);
}

@media (min-width: 900px) {
    .cyberpunk .boxtree {
        --gap: 30px;
        --border-height: 5px;
        --padding: 20px;
    }
}

@media (min-width: 600px) {
    .cyberpunk .boxtree {
        --gap: 20px;
        --border-height: 3px;
        --padding: 10px;
    }
}

.cyberpunk .boxtree {
    --gap: 15px;
    --border-height: 1px;
    --padding: 5px;
}

/* Paragraphs and lists */

ol.cyberpunk,
.cyberpunk ol {
  list-style-type:hiragana-iroha; counter-reset: li
}

ol.cyberpunk > li,
.cyberpunk ol > li {
  list-style: none;
  position: relative;
  font-size: 1.2rem;
  counter-increment: li;
}

/* Titles */

h1.cyberpunk,
h2.cyberpunk,
h3.cyberpunk,
h4.cyberpunk,
.cyberpunk h1,
.cyberpunk h2,
.cyberpunk h3,
.cyberpunk h4 {
  font-size: 2rem;
  line-height: 2.2rem;
  font-weight: 200;
  position: relative;
  padding-bottom: 15px;
}

h2.cyberpunk,
.cyberpunk h2 {
  font-size: 1.7rem;
  line-height: 1.9rem;
  font-weight: 300;
}

h3.cyberpunk,
.cyberpunk h3 {
  font-size: 1.4rem;
  line-height: 1.6rem;
  font-weight: 500;
}

h4.cyberpunk,
.cyberpunk h4 {
  font-size: 1rem;
  line-height: 1.2rem;
  font-weight: 700;
}

/* BoxTree */
.cyberpunk .boxtree {
  --gap: 15px;
  --border-height: 1px;
  --padding: 5px;
}


@media (min-width: 600px) {
	.cyberpunk .boxtree {
    --gap: 20px;
    --border-height: 3px;
    --padding: 10px;
	}
}

@media (min-width: 900px) {
	.cyberpunk .boxtree {
    --gap: 30px;
    --border-height: 5px;
    --padding: 20px;
	}
}

.cyberpunk .boxtree {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-content: center;
  justify-content: center;
  align-items: stretch;
  gap: var(--gap);
  margin: 60px -50px;
}

.cyberpunk .boxtree > div {
  width: calc(100% - var(--gap));
  box-sizing: border-box;
  border: var(--border-height) dashed var(--blue-color);
  /*border-bottom: var(--border-height) dashed var(--purple-color); */
  padding: var(--padding);
  color: var(--blue-color);
  position: relative;
}

@media (max-width: 599px) {
  .cyberpunk .boxtree > div.width3 {
    word-break: break-all;
  }
}

@media (min-width: 900px) {
  .cyberpunk .boxtree {
    margin: 0px;
  }

}

/* Steps */



.cyberpunk ul.steps li.current:after {
 background-color: var(--black-color);
}

.cyberpunk.black ul.steps li.current:after {
  background-color: var(--yellow-color);
}

.cyberpunk .boxtree > div:after {
    clip-path: polygon(calc(50% - 2px) 0%, calc(50% - 2px) 100%, calc(50% + 2px) 100%, calc(50% + 2px) 0%);
}

.cyberpunk .boxtree > .children2:after {
    clip-path: polygon(calc(25% - 2px) 0%, calc(25% - 2px) 100%, calc(25% + 2px) 100%, calc(25% + 2px) 0%, calc(75% - 2px) 0%, calc(75% - 2px) 100%, calc(75% + 2px) 100%, calc(75% + 2px) 0%);
}

.cyberpunk .boxtree > div:after {
  content: "";
  position: absolute;
  width: 100%;
  height: var(--gap);
  background-color: var(--blue-color);
  left: 0px;
  bottom: calc( 0px - var(--gap) - var(--border-height));
  clip-path: polygon(calc(50% - 2px) 0%, calc(50% - 2px) 100%, calc(50% + 2px) 100%, calc(50% + 2px) 0%);
}

.cyberpunk.black .boxtree > div:after {
  background-color: var(--yellow-color);
}

.cyberpunk .boxtree > div {
  width: calc(50% - var(--gap));
}

.cyberpunk .boxtree > .children2:after {
  clip-path: polygon(calc(25% - 2px) 0%, calc(25% - 2px) 100%, calc(25% + 2px) 100%, calc(25% + 2px) 0%, calc(75% - 2px) 0%, calc(75% - 2px) 100%, calc(75% + 2px) 100%, calc(75% + 2px) 0%);
}

.cyberpunk .boxtree > .width1 {
  
  width: calc(100% - var(--gap));
  aspect-ratio: 2 / 1;
}

.cyberpunk .boxtree > .width2 {
  width: calc(50% - var(--gap));  
  aspect-ratio: 1 / 1;
}

.cyberpunk .boxtree > .width3 {
  width: calc(25% - var(--gap));
    aspect-ratio: 4 / 1 !important;  
}

.cyberpunk .boxtree > .width4 {
  width: calc(75% - var(--gap));
  aspect-ratio: 3 / 1 !important;
}

div.width1:last-of-type:after,
div.width2 :last-of-type:after,
div.width2:nth-last-child(2):after,
div.width2:nth-last-child(1):after,
div.width3:last-of-type:after,
div.width4:last-of-type:after {
  content:"";
  display: none;
}

.deal.pink {
  border-color: var(--neon-pink) !important;
}
.deal.blue {
  border-color: var(--neon-blue) !important;
}
.deal.purple {
  border-color: var(--neon-purple) !important;
}
.deal.yellow {
  border-color: var(--cyber-yellow) !important;
}
.deal.green {
  border-color: var(--cyber-green) !important;
}
.deal.orange {
  border-color: var(--cyber-orange) !important;
}

.cyberpunk .boxtree > .deal.pink::after {
    background-color: var(--neon-pink);
}
.cyberpunk .boxtree > .deal.blue::after {
    background-color: var(--neon-blue);
}
.cyberpunk .boxtree > .deal.purple::after {
    background-color: var(--neon-purple);
}
.cyberpunk .boxtree > .deal.yellow::after {
    background-color: var(--cyber-yellow);
}
.cyberpunk .boxtree > .deal.green::after {
    background-color: var(--cyber-green);
}
.cyberpunk .boxtree > .deal.orange::after {
    background-color: var(--cyber-orange);
}

.deal {
  backdrop-filter: blur(8px);

  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  align-content: center;
  justify-content: space-between;
  align-items: stretch;
}

.cyberpunk .boxtree .deal.green.width1.banner-middle:after {
  clip-path: polygon(
  calc(10.5% - 2px) 0%, calc(10.5% - 2px) 100%, 
  calc(10.5% + 2px) 100%, calc(10.5% + 2px) 0%, 
  calc(50% - 2px) 0%, calc(50% - 2px) 100%, 
  calc(50% + 2px) 100%, calc(50% + 2px) 0%,
  calc(89.5% - 2px) 0%, calc(89.5% - 2px) 100%, 
  calc(89.5% + 2px) 100%, calc(89.5% + 2px) 0%
  )
}

</style>