import { browser } from '$app/environment';
import { loadDegreeData } from './requirements';
import { cms } from './content';

function getLangPreference() {
	if (!browser) {
		return cms.he;
	}

	const localLang = localStorage.getItem('lang');

	if (localLang === 'he') {
		return cms.he;
	}
	if (localLang === 'en') {
		return cms.en;
	} else {
		localStorage.setItem('lang', 'he');
		return cms.he;
	}
}

export let content = $state({ lang: getLangPreference() });

const version = 1;

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
		return userData !== null
			? JSON.parse(userData)
			: {
					semesters: [],
					currentSemester: 0,
					wishlist: [],
					username: undefined,
					degree: undefined
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
	}
];

export function loadUser(): UserData {
	if (!browser) {
		return {
			semesters: [],
			currentSemester: 0,
			wishlist: [],
			username: undefined,
			degree: undefined
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
let _degreeData: DegreeData | undefined = $state(undefined);
export const degreeData = () => _degreeData;

$effect.root(() => {
	$effect(() => {
		localStorage.setItem('version', version.toString());
		localStorage.setItem('userData', JSON.stringify(user));
	});

	$effect(() => {
		if (user.degree !== undefined) {
			loadDegreeData(user.degree).then((d) => (_degreeData = d));
		}
	});
});
