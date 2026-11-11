import { storageKey } from '$lib/deploymentEnvironment';
import { browser } from '$app/environment';
import { cms } from './content';

function getLangPreference() {
	const defaultLang = cms.he;
	if (!browser) return defaultLang;

	try {
		const localLang = localStorage.getItem(storageKey('lang'));
		if (localLang === 'he') return cms.he;
		if (localLang === 'en') return cms.en;
		localStorage.setItem(storageKey('lang'), defaultLang.lang);
	} catch {
		// Language selection still works when browser storage is blocked.
	}
	return defaultLang;
}

export const content = $state({ lang: getLangPreference() });
