import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';

const preferences = vi.hoisted(() => ({ lang: { lang: 'en' as 'en' | 'he' } }));
vi.mock('$lib/preferences.svelte', () => ({ content: preferences }));
import PwaStatusView from './PwaStatusView.svelte';

describe('footer status while an update waits', () => {
	it.each(['en', 'he'] as const)(
		'keeps the %s offline state visible independently of update dismissal',
		(language) => {
			preferences.lang.lang = language;
			const { body } = render(PwaStatusView, {
				props: {
					allReady: true,
					offline: true,
					unavailable: false,
					shell: 'ready',
					showPreparing: false,
					updateReady: true,
					onRetry: () => {}
				}
			});
			const statusTag = body.match(/<p\b[^>]*role="status"[^>]*>/)?.[0];
			expect(statusTag).toBeDefined();
			expect(statusTag).not.toContain('sr-only');
			expect(body).toContain(language === 'he' ? 'אין אינטרנט' : 'Offline');
		}
	);
});
