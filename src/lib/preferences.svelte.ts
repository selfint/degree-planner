import { browser } from '$app/environment';
import { cms } from './content';

function getLangPreference() {
	const defaultLang = cms.he;
	if (!browser) return defaultLang;

	try {
		const localLang = localStorage.getItem('lang');
		if (localLang === 'he') return cms.he;
		if (localLang === 'en') return cms.en;
		localStorage.setItem('lang', defaultLang.lang);
	} catch {
		// Language selection still works when browser storage is blocked.
	}
	return defaultLang;
}

export let content = $state({ lang: getLangPreference() });
