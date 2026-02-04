<template>


  <v-app theme="dark">
    <v-main class="centered-content">
      <div class="container flexVertical">
        <Header />
        <div class="pages" >
          <PageServerOffline v-if="navigation_state_page === 'server_offline'" />
          <PageOffline v-if="navigation_state_page === 'offline'" />
          <PageMobile v-else-if="navigation_state_page === 'mobile'" />
          <PageGamesDisplay v-if="navigation_state_page === 'games'" @game-clicked="handleGameClicked" />
          <PageJackIn v-else-if="navigation_state_page === 'jackin'" />
          <PageShop v-else-if="navigation_state_page === 'shop' && is_authenticated" />
          <PageUnifiedTransactions v-else-if="navigation_state_page === 'transactions'" />
          <BackgroundAndButtons />
        </div>
        <Footer />
      </div>
    </v-main>
  </v-app>


</template>


<script setup>


////////////////////////////////////////////////////////////////////////////////////

import { onMounted, nextTick, onBeforeUnmount,  computed, defineAsyncComponent } from "vue";
import { VApp, VMain } from "vuetify/components";


const PageJackIn = computed(() => defineAsyncComponent(() => import(`./components/pages/PageJackIn.vue`)));
const PageShop = computed(() => defineAsyncComponent(() => import(`./components/pages/PageShop.vue`)));
const PageGamesDisplay = computed(() => defineAsyncComponent(() => import(`./components/pages/PageGamesDisplay.vue`)));
const PageUnifiedTransactions = computed(() => defineAsyncComponent(() => import(`./components/pages/PageUnifiedTransactions.vue`)));
const PageServerOffline = computed(() => defineAsyncComponent(() => import(`./components/pages/PageServerOffline.vue`)));
const PageOffline = computed(() => defineAsyncComponent(() => import(`./components/pages/PageOffline.vue`)));
const PageMobile = computed(() => defineAsyncComponent(() => import(`./components/pages/PageMobile.vue`)));
const Header = computed(() => defineAsyncComponent(() => import(`./components/others/Header.vue`)));
const Footer = computed(() => defineAsyncComponent(() => import(`./components/others/Footer.vue`)));
const BackgroundAndButtons = computed(() => defineAsyncComponent(() => import(`./components/BackgroundAndButtons.vue`)));

////////////////////////////////////////////////////////////////////////////////////


import { useGlobalStore } from "@/client/stores/global";
import { storeToRefs } from "pinia";
import { sessionManager } from "@/client/scripts/sessionManager.js";

////////////////////////////////////////////////////////////////////////////////////

  const store = useGlobalStore();
  const { navigation_state_page, is_authenticated} = storeToRefs(store);
  const handleGameClicked = (gameName) => {
    navigation_state_page.value = "shop";
  };

onMounted(() => {
  // Initialize session manager with global store
  sessionManager.init(store);

  nextTick(() => {
    console.log('[APP] Session manager initialized, checking for existing sessions');
  });

  onBeforeUnmount(() => {
    // Clean up session manager if needed
  });
});

</script>


<style scoped>
.container,
.v-application,
#app {
  background-color: transparent !important;
}

#app,
.v-application {
  width: 100%;
}

main.v-main.centered-content {
  width: 100%;
  height: 100%;
  display: block;
}

div.container.flexVertical {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100vw;
}


</style>
