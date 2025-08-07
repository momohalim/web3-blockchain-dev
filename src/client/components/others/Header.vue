<template>
<div class="header" ref="headerRef">

</div>
</template>

<script>
export default {
  name: 'Header',
  setup() {
    // Any setup logic for the footer can go here
  }
}
</script>

<style scoped>
.header {
  display: flex;
  position: relative;
  top: 0;
  left: 0;
  width: 100%;
  color: white;
  z-index: 1000;
  border-bottom: 2px solid var(--cyber-yellow); /* Changed to a named color */
  height: 48px;
  font-weight: bold;
  color: var(--cyber-yellow);
  background-color: rgb(5 15 42);
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  font-family: "Orbitron", sans-serif;
  font-size: 1rem;
  justify-content: space-between;
}

@media (max-width: 300px) {
  .header {
    font-size: 0.5rem;
  }
  .header > div > img {
    width: 30px !important;
    height: 30px !important;
  }
}

</style>