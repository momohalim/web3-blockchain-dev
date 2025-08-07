<template>
  <div class="server-offline">
    <div class="offline-container">
      <div class="error-icon">⚠️</div>
      <h1 class="error-title">Server Offline</h1>
      <p class="error-message">
        The server is currently offline. Please try again later.
      </p>
      <button @click="retry" class="retry-btn">
        Retry Connection
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
.server-offline {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #001122, #000a0f);
}

.offline-container {
  text-align: center;
  padding: 40px;
  border: 2px solid #ff4444;
  border-radius: 15px;
  background: rgba(0, 0, 0, 0.8);
}

.error-icon {
  font-size: 4rem;
  margin-bottom: 20px;
}

.error-title {
  color: #ff4444;
  font-size: 2.5rem;
  margin-bottom: 20px;
}

.error-message {
  color: #ccc;
  font-size: 1.2rem;
  margin-bottom: 30px;
}

.retry-btn {
  padding: 12px 24px;
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.3s ease;
}

.retry-btn:hover {
  background: #ff6666;
}
</style>
