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

const version = 2;

const loaders = [
	function load_0(): UserData {
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

	function load_1(): UserData {
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

	function load_2(): UserData {
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
			degree: undefined,
			path: undefined
		};
	}
];

const migrations = [
	function migrate_0_1(v0: UserData): UserData {
		// save new user data
		localStorage.setItem('version', '1');
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
	function migrate_1_2(v1: UserData): UserData {
		// save new user data
		localStorage.setItem('version', '2');
		localStorage.setItem('userData', JSON.stringify(v1));

		// other than that data is the same
		return v1;
	}
];

export function loadUser(): UserData {
	if (!browser) {
		return {
			semesters: [],
			currentSemester: 0,
			wishlist: [],
			username: undefined,
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

	return user;
}

export const user: UserData = $state(loadUser());
let _catalog: Catalog | undefined = $state(undefined);
export const catalog = () => _catalog;

$effect.root(() => {
	$effect(() => {
		localStorage.setItem('version', version.toString());
		localStorage.setItem('userData', JSON.stringify(user));
	});

	$effect(() => {
		if (user.degree !== undefined) {
			loadCatalog(user.degree).then((d) => (_catalog = d));
		}
	});
});
