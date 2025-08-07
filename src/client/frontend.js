////////////////////////////////////////////////////////////////////////////

import { createApp, h, } from 'vue';

import { createPinia } from 'pinia';

import './style.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import vLazy from 'vue3-lazyload';
import axios from 'axios';
import { useGlobalStore } from './stores/global.js';
import { storeToRefs } from "pinia";
import App from './App.vue';

const pinia = createPinia();

const vuetify = createVuetify({
  components,
  directives,
})

axios.interceptors.response.use(
  response => response,
  error => {
    // If no response (network/server down) or 502/503/504
    if (!error.response || [502, 503, 504].includes(error.response?.status)) {
      const store = useGlobalStore();
      const { navigation_state_page } = storeToRefs(store);
      navigation_state_page.value = 'server_offline';
    }
    return Promise.reject(error);
  }
);

createApp(App)
  .use(pinia)
  .use(vLazy, { loading: '/website/placeholder_games.png' })
  .use(vuetify)
  .mount('#app');


if (window.location.search.includes('installed=true')) {
  document.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen mode:', err);
      });
    }
  });
}