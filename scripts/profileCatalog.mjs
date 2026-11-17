import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { localQaOrigin } from './localQa.mjs';
const out = process.argv[2] || '/tmp/catalog-profile';
const origin = localQaOrigin(
	process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173'
);
const guest = {
	degree: ['2021_200', '00002120', 'SC00001313_CG00004522'],
	semesters: [['01040033', '02340124'], [], []],
	currentSemester: 1,
	exemptions: [],
	wishlist: []
};
const browser = await chromium.launch();
const results = [];
try {
	for (const rate of [1, 4])
		for (let run = 0; run < 2; run++) {
			const context = await browser.newContext({
				viewport: { width: 390, height: 844 },
				isMobile: true,
				hasTouch: true,
				serviceWorkers: 'block',
				...(process.env.QA_DENY_PROXY
					? {
							proxy: {
								server: process.env.QA_DENY_PROXY,
								bypass: 'localhost,127.0.0.1,[::1]'
							}
						}
					: {})
			});
			await context.route('**/*', (r) =>
				new URL(r.request().url()).origin === origin ? r.continue() : r.abort()
			);
			await context.addInitScript((guest) => {
				localStorage.setItem('lang', 'en');
				localStorage.setItem('version', '4');
				localStorage.setItem('userData', JSON.stringify(guest));
			}, guest);
			const p = await context.newPage();
			await p.goto(origin + '/app/plan');
			await p.waitForFunction(
				() =>
					document.querySelector('.console-shell:not([inert])') &&
					!document.querySelector('.console-loading'),
				null,
				{ timeout: 60000 }
			);
			const cdp = await context.newCDPSession(p);
			await cdp.send('Emulation.setCPUThrottlingRate', { rate });
			for (let sample = 0; sample < 4; sample++) {
				await p.evaluate(() => {
					window.__catalogResult = null;
					document.addEventListener(
						'click',
						function start(e) {
							if (!e.target.closest('a[href$="/app/catalog"]')) return;
							document.removeEventListener('click', start, true);
							const t = performance.now();
							const check = () => {
								const root = document.querySelector('.catalog-page');
								const name = root?.querySelector('.course-row .course-name');
								const summary = root?.querySelector('.catalog-summary');
								if (
									root?.checkVisibility() &&
									document.querySelector(
										'a[href$="/app/catalog"][aria-current="page"]'
									) &&
									name?.textContent &&
									summary &&
									!summary.querySelector('.catalog-loading')
								) {
									const box = name.getBoundingClientRect();
									const x = Math.max(
										0,
										Math.min(innerWidth - 1, box.x + box.width / 2)
									);
									const y = Math.max(
										0,
										Math.min(innerHeight - 1, box.y + box.height / 2)
									);
									const hit = document.elementFromPoint(x, y);
									if (
										box.width > 0 &&
										box.height > 0 &&
										box.bottom > 0 &&
										box.top < innerHeight &&
										name.closest('.course-card')?.contains(hit)
									) {
										const readyMs = performance.now() - t;
										// Cross a rendering opportunity after visible content and hit testing
										// agree. Whole-catalog correctness scans run outside this interval.
										requestAnimationFrame(() => {
											window.__catalogResult = {
												readyMs,
												usefulMs: performance.now() - t
											};
										});
										return;
									}
								}
								requestAnimationFrame(check);
							};
							requestAnimationFrame(check);
						},
						true
					);
				});
				const profile =
					process.env.CATALOG_CPU_PROFILE === '1' &&
					rate === 4 &&
					run === 0 &&
					sample === 1;
				if (profile) {
					await cdp.send('Profiler.enable');
					await cdp.send('Profiler.start');
				}
				await p.locator('a[href="/app/catalog"]:visible').first().click();
				await p.waitForFunction(() => window.__catalogResult, null, {
					timeout: 120000
				});
				if (profile) {
					const { profile: cpu } = await cdp.send('Profiler.stop');
					fs.writeFileSync(out + '.cpuprofile', JSON.stringify(cpu));
				}
				const value = await p.evaluate(() => ({
					...window.__catalogResult,
					cards: document.querySelectorAll('.catalog-page .course-card').length,
					nodes: document.querySelectorAll('.catalog-page *').length
				}));
				results.push({
					rate,
					run,
					sample,
					kind: sample === 0 ? 'first-switch' : 'repeat',
					...value
				});
				console.log(JSON.stringify(results.at(-1)));
				await p.locator('a[href="/app/plan"]:visible').first().click();
				await p.locator('.catalog-page').waitFor({ state: 'hidden' });
			}
			await context.close();
		}
} finally {
	await browser.close();
	fs.writeFileSync(out + '.json', JSON.stringify(results, null, 2));
}
