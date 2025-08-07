<template>


  <div class="page">
    <div v-if="navigation_state_overlay === 'jackin'" class="overlay jackin">
      <h1 class="glitch" data-text="Access to play">Access to play</h1>
      <button class="jack-in" ref="recaptchaButton" @click="onJackInClick">JACK IN</button>
    </div>
  </div>


</template>


<script setup>

import { useGlobalStore } from '@/client/stores/global';
import { storeToRefs } from 'pinia';
import { onMounted, ref } from 'vue';
import axios from 'axios';

const store = useGlobalStore();
const { navigation_state_page, navigation_state_overlay } = storeToRefs(store);

function onJackInClick() {
  navigation_state_page.value = 'games';
}

onMounted(() => {

});

</script>


<style scoped>


.page {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  justify-content: center;
  align-items: center;
}

.overlay.jackin {
  margin:auto;
  max-width: 540px;
  max-height: 344px;
}

.overlay h1 {
    font-size: 3rem;
}

button.jack-in {
  min-width: 108px;
  min-height: 38px;
  margin:auto;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
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

</style>