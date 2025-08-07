import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useGlobalStore = defineStore('global', () => {
	// UI state
	const navigation_state_page = ref('jackin');
	const navigation_state_overlay = ref('jackin');
	const navigation_state_dialog = ref('');//ref('yes_no');
	// Wallet and authentication
	const crypto_selected = ref('solana');
	const wallet_selected = ref('phantom');
	const is_authenticated = ref(false);
	const wallet_connected_address = ref('');

	const walletIconPath = ref('');
	const cryptoIconPath = ref('');

	const showDropdownProfile = ref(false);

	// Audio player
	const is_muted = ref(false);
	const volume_music = ref(0.1);
	const volume_sfx = ref(0.02);

	// Game currency
	const coin_crypto = ref(-1);
	const chip_yellow = ref(-1);
	const chip_red = ref(-1);
	const chip_blue = ref(-1);
	const chip_green = ref(-1);

	// Current game session
	const game_playing_name = ref('');
	const game_playing_input = ref(-1);
	const game_playing_bet_type = ref('red');
	const game_playing_bet_amount = ref(1);
	const game_playing_waiting_result = ref(false);

	const has_notifications = ref(false);
	const slides = ref([]);

	// const globalStore = useGlobalStore();
	// globalStore.setAuthenticated(walletAddress, walletBalance);

	// function setAuthenticated(walletAddress, walletBalance) {
	// 	is_authenticated.value = true;
	// 	wallet_connected_address.value = walletAddress;
	// 	coin_crypto.value = walletBalance;
	// }

	return {
		navigation_state_page,
		navigation_state_overlay,
		navigation_state_dialog,
		showDropdownProfile,
		crypto_selected,
		wallet_selected,
		is_authenticated,
		wallet_connected_address,
		coin_crypto,
		chip_yellow,
		chip_red,
		chip_blue,
		chip_green,
		game_playing_name,
		game_playing_input,
		game_playing_bet_type,
		game_playing_bet_amount,
		game_playing_waiting_result,
		walletIconPath,
		cryptoIconPath,
		is_muted,
		volume_music,
		volume_sfx,
		has_notifications,
		slides,
		// setAuthenticated,
	};
});
