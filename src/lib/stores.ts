import { writable, get } from 'svelte/store';

export const userData = writable<UserData | undefined>(undefined);

export function storeUserData() {
	const user = get(userData);
	if (user) {
		localStorage.setItem('userData', JSON.stringify(user));
	}
}

export function loadUserData() {
	const data = localStorage.getItem('userData');
	if (data) {
		userData.set(JSON.parse(data));
	}
}

userData.subscribe(storeUserData);
