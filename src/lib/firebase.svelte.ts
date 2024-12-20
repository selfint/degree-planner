import { user } from './stores.svelte';

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
	getAuth,
	connectAuthEmulator,
	type Auth as FirebaseAuth,
	signInWithPopup,
	GoogleAuthProvider,
	browserLocalPersistence,
	type User as FirebaseUser
} from 'firebase/auth';
import {
	getAnalytics,
	isSupported,
	type Analytics as FirebaseAnalytics
} from 'firebase/analytics';
import {
	getFirestore,
	type Firestore as FirebaseFirestore,
	connectFirestoreEmulator
} from 'firebase/firestore';
import {
	collection,
	getDoc,
	doc,
	setDoc,
	QueryDocumentSnapshot
} from 'firebase/firestore';

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
	firestore: FirebaseFirestore;
	analytics?: FirebaseAnalytics;
};

export type FirestoreData = {
	version: 2;
	semesters?: string[][];
	currentSemester?: number;
	wishlist?: string[];
	degree?: [string, string, string];
	path?: string;
};

export async function initFirebase(): Promise<FirebaseServices> {
	const app = initializeApp(firebaseConfig);
	const auth = getAuth(app);

	const firestore = getFirestore(app);

	let analytics = undefined;
	if (await isSupported()) {
		analytics = getAnalytics(app);
	}

	if (!import.meta.env.PROD) {
		connectAuthEmulator(auth, 'http://127.0.0.1:9099');
		connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
	}

	await auth.setPersistence(browserLocalPersistence);

	return { app, auth, firestore, analytics };
}

const courseSeparator = '-';

function encodeSemesters(semesters: string[][]): string[] {
	return semesters.map((semester) => semester.join(courseSeparator));
}

function decodeSemesters(encodedSemesters: string[]): string[][] {
	return (
		encodedSemesters.map((s) =>
			s.split(courseSeparator).filter((c) => c !== '')
		) ?? []
	);
}

export async function syncFirebase(firebase: FirebaseServices) {
	if (firebase.auth.currentUser === null) {
		return;
	}

	const users = collection(firebase.firestore, 'users').withConverter({
		toFirestore: (data: FirestoreData) => {
			// @ts-expect-error
			data.semesters = encodeSemesters(data.semesters ?? []);
			data.currentSemester = data.currentSemester ?? 0;
			data.wishlist = data.wishlist ?? [];
			// @ts-expect-error
			data.degree = data.degree ?? null;
			// @ts-expect-error
			data.path = data.path ?? null;

			return data;
		},
		fromFirestore: (snap: QueryDocumentSnapshot) => {
			const d = snap.data();

			d.semesters = decodeSemesters(d.semesters);
			d.degree = d.degree ?? undefined;
			d.path = d.path ?? undefined;

			return d as FirestoreData;
		}
	});
	const userDoc = doc(users, firebase.auth.currentUser.uid);
	const userData = await getDoc(userDoc);

	if (!userData.exists()) {
		const newFirestoreData: FirestoreData = {
			version: 2,
			semesters: user.semesters,
			currentSemester: user.currentSemester,
			wishlist: user.wishlist,
			degree: user.degree,
			path: user.path
		};

		await setDoc(userDoc, newFirestoreData);
	} else {
		const d = userData.data();
		user.semesters = d.semesters ?? [];
		user.currentSemester = d.currentSemester ?? 0;
		user.wishlist = d.wishlist ?? [];
		user.degree = d.degree as Degree | undefined;
		user.path = d.path;
	}
}

export async function signIn(firebase: FirebaseServices) {
	const result = await signInWithPopup(firebase.auth, new GoogleAuthProvider());

	const credential = GoogleAuthProvider.credentialFromResult(result);
	if (credential === null) {
		return;
	}

	await syncFirebase(firebase);
}
