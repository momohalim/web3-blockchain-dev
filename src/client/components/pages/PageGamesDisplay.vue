<template>

  
  <OverlayWalletsConnect v-if="navigation_state_overlay === 'wallets_connect'" @close_overlay="navigation_state_overlay = ''"/>

  <div class="page">

  <div class="game-cover-container" style="width: 90%; height:90%; overflow-y: unset;">
    <button class="game-button" @click="onGameClicked($event, '2_doors')">
      <img alt="Game cover artwork from CyberBet.Games for the game 2 Doors" class="game-cover unlocked 2_doors" v-lazy="'/website/placeholder_games.png'">
    </button>

    
    </div>
  </div>


</template>


<script>


import { useGlobalStore } from '@/client/stores/global'
import { storeToRefs } from 'pinia';
import { computed, defineAsyncComponent } from "vue";
import { websocketGet } from '../../scripts/websocketClient';


import OverlayWalletsConnect from '../overlays/OverlayWalletsConnect.vue';

export default {
  name: 'GamesDisplay',
  components: {
    OverlayWalletsConnect,
  },
  emits: ['game-clicked'],
  setup() {
    const store = useGlobalStore();
    const { is_authenticated, navigation_state_overlay, game_playing_name, game_playing_input, game_playing_bet_type, game_playing_bet_amount, game_playing_waiting_result } = storeToRefs(store);

    game_playing_name.value = '';
	  game_playing_input.value = -1;
	  game_playing_bet_type.value = 'red';
	  game_playing_bet_amount.value = 1;
    game_playing_waiting_result.value = false;

    return {
      navigation_state_overlay,
      is_authenticated,
      gameIcons: import.meta.glob('./games/covers*.png', { eager: true }),
    };
  },
  methods: {
    onGameClicked(event, gameName) {
      if (!this.is_authenticated) {
        this.navigation_state_overlay = 'wallets_connect'; // Show overlay if not authenticated
        return;
      } else if ( event.target.classList.contains('unlocked') || event.target.parentNode.classList.contains('unlocked') ) {

      this.$emit('game-clicked', gameName)

      }
    },
  },
};


</script>


<style scoped>

.page {
  width: 100vmin;
  /* width: calc(100vmin - 96px); */
  height: min-content;
  /* aspect-ratio: 1 / 1 !important; */
  margin: auto;
  overflow-y: auto;
  display: flex;
  transform: scale(0.8) translateY(calc(-79px + 1.5rem));
  /* margin-top: calc(-79px + 1.5rem); */
}

.game-cover-container {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  align-content: space-between;
  /* padding: 3vmin; */
  width: 100% !important;
  justify-content: space-around;
}

img.game-cover {
    margin: 0 5vmin;
    width: 30vmin;
    padding: 30px;
    padding-left: 5px;
    padding-right: 5px;
    padding-bottom: 15px;
    clip-path: polygon(0px 25px, 26px 0px, calc(60% - 25px) 0px, 60% 25px, 100% 25px, 100% calc(100% - 10px), calc(100% - 15px) calc(100% - 10px), calc(80% - 10px) calc(100% - 10px), calc(80% - 15px) calc(100% - 0px), 10px calc(100% - 0px), 0% calc(100% - 10px));
    max-width: calc(100% - 10px);
    background: black;
    background-size: 5px 5px;
    background-position: -13px -3px;
    transform:scale(0.9);
    margin: 0;
}

@media (max-width: 300px) {
  img.game-cover {
    width: 44vmin
  }
  .page {
    height: 100%
  }
}

.locked {
  opacity:0.5;
}

.locked:hover {
  transform: scale(0.8);
  transition: transform 0.3s ease-in-out;
}

.unlocked:hover {
  transform: scale(1.0);
  transition: transform 0.3s ease-in-out;
}


</style>
