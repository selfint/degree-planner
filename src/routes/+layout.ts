import type { LayoutLoad } from './$types';

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
	getAuth,
	connectAuthEmulator,
	type Auth as FirebaseAuth
} from 'firebase/auth';

const firebaseConfig = {
	apiKey: 'AIzaSyBU4Z-kNIh2B1pVy5QZMuZsY9NqTp487i4',
	authDomain: 'degree-planner-d8f8d.firebaseapp.com',
	projectId: 'degree-planner-d8f8d',
	storageBucket: 'degree-planner-d8f8d.firebasestorage.app',
	messagingSenderId: '625307050657',
	appId: '1:625307050657:web:9c6134abdc1ac0fc5cc6e0',
	measurementId: 'G-9XWSYCZWZX'
};

export type FirebaseServices = {
	app: FirebaseApp;
	auth: FirebaseAuth;
};

export const load: LayoutLoad = async () => {
	const app = initializeApp(firebaseConfig);
	const auth = getAuth(app);

	if (!import.meta.env.PROD) {
		connectAuthEmulator(auth, 'http://127.0.0.1:9099');
	}

	return { app, auth };
};
