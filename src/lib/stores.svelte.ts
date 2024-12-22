import { browser } from '$app/environment';
import { loadCatalog } from './requirements';
import { cms } from './content';

function getLangPreference() {
	const defaultLang = cms.he;

	if (!browser) {
		return defaultLang;
	}

	const localLang = localStorage.getItem('lang');

	if (localLang === 'he') {
		return cms.he;
	}

	if (localLang === 'en') {
		return cms.en;
	} else {
		localStorage.setItem('lang', defaultLang.lang);
		return defaultLang;
	}
}

export let content = $state({ lang: getLangPreference() });

const version = 3 as const;

const loaders = [
	function load_0(): UserDataV1 {
		const username = localStorage.getItem('username');
		const degree = localStorage.getItem('degree');
		const semesters = localStorage.getItem('semesters');
		const currentSemester = localStorage.getItem('currentSemester');
		const wishlist = localStorage.getItem('wishlist');

		return {
			semesters: semesters ? JSON.parse(semesters) : [],
			currentSemester: currentSemester ? parseInt(currentSemester) : 0,
			wishlist: wishlist ? JSON.parse(wishlist) : [],
			username: username ?? undefined,
			degree: degree ? JSON.parse(degree) : undefined
		};
	},

	function load_1(): UserDataV1 {
		const userData = localStorage.getItem('userData');
		if (userData !== null) {
			try {
				const data: UserData = JSON.parse(userData);

				data.semesters = data.semesters.map((s) => s.filter((c) => c !== ''));

				return data;
			} catch (error) {
				console.error('Failed to load user data', error);
			}
		}

		return {
			semesters: [],
			currentSemester: 0,
			wishlist: [],
			username: undefined,
			degree: undefined
		};
	},

	function load_2(): UserDataV2 {
		const userData = localStorage.getItem('userData');
		if (userData !== null) {
			try {
				const data: UserDataV2 = JSON.parse(userData);

				data.semesters = data.semesters.map((s) => s.filter((c) => c !== ''));

				return data;
			} catch (error) {
				console.error('Failed to load user data', error);
			}
		}

		return {
			semesters: [],
			currentSemester: 0,
			wishlist: [],
			username: undefined,
			degree: undefined,
			path: undefined
		};
	},

	function load_3(): UserData {
		const userData = localStorage.getItem('userData');
		if (userData !== null) {
			try {
				const data: UserData = JSON.parse(userData);

				data.semesters = data.semesters.map((s) => s.filter((c) => c !== ''));

				return data;
			} catch (error) {
				console.error('Failed to load user data', error);
			}
		}

		return {
			exemptions: [],
			semesters: [],
			currentSemester: 0,
			wishlist: [],
			degree: undefined,
			path: undefined
		};
	}
] as const;

const migrations = [
	function migrate_0_1(v0: UserDataV1): UserDataV1 {
		// update version
		localStorage.setItem('version', '1');

		// save new user data
		localStorage.setItem('userData', JSON.stringify(v0));

		// clear old localStorage
		localStorage.removeItem('username');
		localStorage.removeItem('degree');
		localStorage.removeItem('semesters');
		localStorage.removeItem('currentSemester');
		localStorage.removeItem('wishlist');

		// other than that data is the same
		return v0;
	},
	function migrate_1_2(v1: UserDataV1): UserDataV2 {
		// update version
		localStorage.setItem('version', '2');

		const v2: UserDataV2 = { ...v1 };

		// migrate degree and path
		if (v1.degree !== undefined) {
			const degree = v1.degree;

			degree[0] = '2024_200';

			const faculty = degree[1] as string;
			if (faculty === 'computer_science') {
				degree[1] = '00002120';
				const path = degree[2] as string;

				if (path === '4_year') {
					degree[2] = 'SC00001313_CG00006209';
					v2.path = 'CG00006210';
				} else if (path === 'Computer_Engineering') {
					degree[2] = 'SC00001306_CG00006135';
					// no path
					v2.path = undefined;
				} else if (path === 'ML_&_data_analysis') {
					degree[2] = 'SC00001314_CG00006245';
					v2.path = 'CG00006253';
				} else {
					// default to 3 year path
					degree[2] = 'SC00001320_CG00006382';
					v2.path = 'CG00006246';
				}
			} else {
				degree[1] = '00002080';
				degree[2] = 'SC00001391_CG00006095';
			}

			v2.degree = degree;
		}

		// save new user data
		localStorage.setItem('userData', JSON.stringify(v2));

		// other than that data is the same
		return v2;
	},
	function migrate_2_3(v2: UserDataV2): UserData {
		// update version
		localStorage.setItem('version', '3');

		delete v2.username;

		const v3: UserData = {
			exemptions: [],
			...v2
		};

		// save new user data
		localStorage.setItem('userData', JSON.stringify(v3));

		return v3;
	}
] as const;

export const user: { d: UserData } = $state({ d: readLocalStorage() });
export function setUser(data: UserData) {
	user.d = data;
}

let _catalog: Catalog | undefined = $state(undefined);
export const catalog = () => _catalog;

function readLocalStorage(): UserData {
	if (!browser) {
		return {
			exemptions: [],
			semesters: [],
			currentSemester: 0,
			wishlist: [],
			degree: undefined,
			path: undefined
		};
	}

	let localVersion = parseInt(localStorage.getItem('version') ?? '0');

	if (localVersion > version) {
		// try to load the user data with the latest loader
		return loaders[version]();
	}

	let user = loaders[localVersion]();
	while (localVersion < version) {
		user = migrations[localVersion](user);
		localVersion++;
	}

	return user as UserData;
}

export async function writeLocalStorage(data: UserData): Promise<UserData> {
	localStorage.setItem('version', version.toString());
	localStorage.setItem('userData', JSON.stringify(data));

	return data;
}

export interface StorageMethod {
	read: () => Promise<UserData>;
	write: (data: UserData) => Promise<UserData>;
}

export const localStorageMethod: StorageMethod = {
	read: async () => readLocalStorage(),
	write: writeLocalStorage
};

let _storage: StorageMethod = $state(localStorageMethod);
export const readStorage = async () => await _storage.read();
export const writeStorage = async (d: UserData) => await _storage.write(d);
export const setStorage = (s: StorageMethod) => (_storage = s);

$effect.root(() => {
	$effect(() => {
		if (user.d.degree !== undefined) {
			loadCatalog(user.d.degree, user.d.path).then((d) => (_catalog = d));
		}
	});
});
