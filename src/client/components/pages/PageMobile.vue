<template>
  <div class="mobile">
    <div class="mobile-container">
      <div class="mobile-icon">📱</div>
      <h1 class="mobile-title">Mobile View</h1>
      <p class="mobile-message">
        This application is optimized for desktop. Some features may be limited on mobile devices.
      </p>
      <button @click="continue" class="continue-btn">
        Continue Anyway
      </button>
    </div>
  </div>
</template>

<script setup>
import { useGlobalStore } from '@/client/stores/global.js';
import { storeToRefs } from 'pinia';

const store = useGlobalStore();
const { navigation_state_page } = storeToRefs(store);

function continue() {
  navigation_state_page.value = 'jackin';
}
</script>

<style scoped>
.mobile {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #001122, #000a0f);
}

.mobile-container {
  text-align: center;
  padding: 40px;
  border: 2px solid #00ff88;
  border-radius: 15px;
  background: rgba(0, 0, 0, 0.8);
}

.mobile-icon {
  font-size: 4rem;
  margin-bottom: 20px;
}

.mobile-title {
  color: #00ff88;
  font-size: 2.5rem;
  margin-bottom: 20px;
}

.mobile-message {
  color: #ccc;
  font-size: 1.2rem;
  margin-bottom: 30px;
  max-width: 400px;
}

.continue-btn {
  padding: 12px 24px;
  background: #00ff88;
  color: black;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.3s ease;
}

.continue-btn:hover {
  background: #00cc70;
}
</style>
