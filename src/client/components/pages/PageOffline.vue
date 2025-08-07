<template>
  <div class="offline">
    <div class="offline-container">
      <div class="offline-icon">📡</div>
      <h1 class="offline-title">You're Offline</h1>
      <p class="offline-message">
        Check your internet connection and try again.
      </p>
      <button @click="retry" class="retry-btn">
        Try Again
      </button>
    </div>
  </div>
</template>

<script setup>
function retry() {
  window.location.reload();
}
</script>

<style scoped>
.offline {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #001122, #000a0f);
}

.offline-container {
  text-align: center;
  padding: 40px;
  border: 2px solid #ffa500;
  border-radius: 15px;
  background: rgba(0, 0, 0, 0.8);
}

.offline-icon {
  font-size: 4rem;
  margin-bottom: 20px;
}

.offline-title {
  color: #ffa500;
  font-size: 2.5rem;
  margin-bottom: 20px;
}

.offline-message {
  color: #ccc;
  font-size: 1.2rem;
  margin-bottom: 30px;
}

.retry-btn {
  padding: 12px 24px;
  background: #ffa500;
  color: black;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.3s ease;
}

.retry-btn:hover {
  background: #ffb733;
}
</style>
