import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
	getAuth,
	connectAuthEmulator,
	type Auth as FirebaseAuth,
	signInWithPopup,
	GoogleAuthProvider,
	browserLocalPersistence
} from 'firebase/auth';
import {
	getAnalytics,
	isSupported,
	type Analytics as FirebaseAnalytics
} from 'firebase/analytics';
import {
	getFirestore,
	type Firestore as FirebaseFirestore,
	connectFirestoreEmulator,
	DocumentReference,
	type Unsubscribe as FirestoreUnsubscribe
} from 'firebase/firestore';
import {
	collection,
	getDoc,
	doc,
	setDoc,
	QueryDocumentSnapshot
} from 'firebase/firestore';
import type { StorageMethod } from './stores.svelte';
import { onSnapshot } from 'firebase/firestore';

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

type FirestoreData =
	| {
			version: 2;
			semesters: string[];
			currentSemester: number;
			wishlist: string[];
			degree: [string, string, string] | null;
			path: string | null;
	  }
	| {
			version: 3;
			exemptions: string[];
			semesters: string[];
			currentSemester: number;
			wishlist: string[];
			degree: [string, string, string] | null;
			path: string | null;
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

function getUserDocRef(
	firebase: FirebaseServices
): DocumentReference<UserData> | undefined {
	if (firebase.auth.currentUser === null) {
		return undefined;
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

	const users = collection(firebase.firestore, 'users').withConverter({
		toFirestore: (data: UserData) => {
			const firestoreData: FirestoreData = {
				version: 3,
				exemptions: data.exemptions,
				semesters: encodeSemesters(data.semesters),
				currentSemester: data.currentSemester ?? 0,
				wishlist: data.wishlist,
				degree: data.degree ?? null,
				path: data.path ?? null
			};

			return firestoreData;
		},
		fromFirestore: (snap: QueryDocumentSnapshot): UserData => {
			const data = snap.data() as FirestoreData;

			switch (data.version) {
				case 2:
					return {
						exemptions: [],
						semesters: decodeSemesters(data.semesters),
						currentSemester: data.currentSemester,
						wishlist: data.wishlist,
						degree: (data.degree ?? undefined) as Degree | undefined,
						path: data.path ?? undefined
					};

				case 3:
					return {
						exemptions: data.exemptions,
						semesters: decodeSemesters(data.semesters),
						currentSemester: data.currentSemester,
						wishlist: data.wishlist,
						degree: (data.degree ?? undefined) as Degree | undefined,
						path: data.path ?? undefined
					};
			}
		}
	});

	const userDoc = doc(users, firebase.auth.currentUser.uid);

	return userDoc;
}

async function writeFirebase(
	firebase: FirebaseServices,
	data: UserData
): Promise<UserData> {
	// sleep 5 seconds
	// await new Promise((resolve) => setTimeout(resolve, 5000));

	const userDoc = getUserDocRef(firebase);
	if (userDoc === undefined) {
		return data;
	}

	await setDoc(userDoc, data);

	return data;
}

async function readFirebase(
	firebase: FirebaseServices
): Promise<UserData | undefined> {
	const userDoc = getUserDocRef(firebase);
	if (userDoc === undefined) {
		return;
	}

	return (await getDoc(userDoc)).data();
}

export function buildFirebaseStorage(
	firebase: FirebaseServices
): StorageMethod {
	return {
		read: async () => {
			const remote = await readFirebase(firebase);
			if (remote !== undefined) {
				return remote;
			}

			return {
				exemptions: [],
				semesters: [],
				currentSemester: 0,
				wishlist: [],
				username: undefined,
				degree: undefined,
				path: undefined
			};
		},
		write: async (data) => writeFirebase(firebase, data)
	};
}

export function subscribeFirebase(
	firebase: FirebaseServices,
	onchange: (data: UserData) => unknown
): FirestoreUnsubscribe | undefined {
	const userDoc = getUserDocRef(firebase);
	if (userDoc === undefined) {
		return undefined;
	}

	return onSnapshot(userDoc, (doc) => {
		if (doc.exists()) {
			onchange(doc.data());
		}
	});
}

export async function signIn(firebase: FirebaseServices) {
	const result = await signInWithPopup(firebase.auth, new GoogleAuthProvider());

	const credential = GoogleAuthProvider.credentialFromResult(result);
	if (credential === null) {
		return;
	}
}
