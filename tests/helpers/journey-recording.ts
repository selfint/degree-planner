import type { BrowserContext, Page, TestInfo, Video } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('test-results/journeys-raw');
export const journeyCaptureEnabled =
	process.env.RECORD_STUDENT_JOURNEYS === '1';
export function journeyRecordingOptions() {
	return journeyCaptureEnabled
		? { recordVideo: { dir: root, size: { width: 960, height: 720 } } }
		: {};
}
export class JourneyRecording {
	private pages = new Map<
		Page,
		{
			video: Video;
			segments: { name: string; title: string }[];
			active: boolean;
		}
	>();
	private order: { page: Page; index: number }[] = [];
	constructor(
		private info: TestInfo,
		private enabled = journeyCaptureEnabled
	) {}
	get theme() {
		return this.enabled && this.info.project.use.colorScheme === 'light'
			? 'light'
			: 'dark';
	}
	async install(context: BrowserContext) {
		if (!this.enabled) return;
		// Context init scripts run in every popup/new tab and after full navigations.
		// Only initial theme is seeded: intentional student theme/language edits survive.
		await context.addInitScript(
			({ theme }) => {
				try {
					if (!localStorage.getItem('theme'))
						localStorage.setItem('theme', theme);
				} catch {
					/* opaque blank page */
				}
				document.addEventListener('DOMContentLoaded', () => {
					const cursor = document.createElement('div');
					cursor.dataset.journeyCursor = '';
					cursor.style.cssText =
						'position:fixed;left:-50px;top:-50px;width:20px;height:20px;border:3px solid #fff;border-radius:50%;background:#0d9488;box-shadow:0 0 0 2px #134e4a;pointer-events:none;z-index:2147483646;transform:translate(-50%,-50%)';
					document.body.append(cursor);
					document.addEventListener('mousemove', (event) => {
						cursor.style.left = `${event.clientX}px`;
						cursor.style.top = `${event.clientY}px`;
					});
					document.addEventListener('mousedown', () => {
						cursor.style.background = '#f59e0b';
					});
					document.addEventListener('mouseup', () => {
						cursor.style.background = '#0d9488';
					});
				});
			},
			{ theme: this.theme }
		);
	}
	private async boundary(page: Page) {
		await page.evaluate(() => {
			const slate = document.createElement('div');
			slate.id = 'journey-boundary';
			slate.style.cssText =
				'position:fixed;inset:0;z-index:2147483647;background:rgb(255,0,255)';
			document.body.append(slate);
		});
		await page.waitForTimeout(350);
		await page.evaluate(() =>
			document.getElementById('journey-boundary')!.remove()
		);
	}
	async begin(page: Page, name: string, title: string) {
		if (!this.enabled) return;
		let entry = this.pages.get(page);
		if (!entry) {
			const video = page.video();
			if (!video) throw new Error('Journey page has no video capture');
			entry = { video, segments: [], active: false };
			this.pages.set(page, entry);
		}
		if (entry.active) throw new Error('End the previous segment first');
		await page.waitForLoadState('domcontentloaded');
		await this.boundary(page);
		entry.active = true;
		this.order.push({ page, index: entry.segments.length });
		const hebrew: Record<string, string> = {
			'setup-and-save': 'שחזור הגדרות שנקטעו ושמירת קורס',
			'reopen-plan': 'פתיחה מחדש של התוכנית השמורה בלשונית חדשה',
			'owner-share': 'יצירת קישור שיתוף מתוכנית הבעלים',
			'share-preview': 'בדיקת התצוגה המקדימה של הקישור',
			'recipient-import': 'אורח עצמאי מבטל, מייבא, פותח מחדש ועורך את העותק',
			'owner-unchanged': 'אימות שתוכנית הבעלים לא השתנתה',
			'choose-current': 'בחירת סמסטר נוכחי תקין לפני ייבוא תוכנית קצרה',
			'protect-current': 'שינוי מפורש של הסמסטר הנוכחי לפני קיצור התוכנית'
		};
		entry.segments.push({
			name,
			title: this.info.title.startsWith('he:') ? (hebrew[name] ?? title) : title
		});
		await page.waitForTimeout(500);
	}
	async end(page: Page) {
		if (!this.enabled) return;
		const entry = this.pages.get(page);
		if (!entry?.active) throw new Error('Journey segment not started');
		await page.waitForTimeout(650);
		await this.boundary(page);
		entry.active = false;
	}
	async finish() {
		if (!this.enabled) return;
		// Failed assertions never create publishable metadata.
		if (this.info.status !== 'passed') return;
		if (!this.pages.size || [...this.pages.values()].some((p) => p.active))
			throw new Error('Incomplete journey recording');
		const language = this.info.title.startsWith('he:') ? 'he' : 'en';
		const topic = this.info.annotations.find(
			(a) => a.type === 'journey'
		)?.description;
		if (!topic) throw new Error('Missing journey topic');
		await mkdir(root, { recursive: true });
		const entries = [...this.pages.entries()];
		for (const [index, [page, entry]] of entries.entries()) {
			if (!page.isClosed()) await page.close();
			await entry.video.saveAs(
				path.join(root, `${topic}-${language}-${this.theme}-page-${index}.webm`)
			);
		}
		const segments = this.order.map(({ page, index }) => ({
			page: entries.findIndex(([p]) => p === page),
			index,
			...this.pages.get(page)!.segments[index]
		}));
		await writeFile(
			path.join(root, `${topic}-${language}-${this.theme}.json`),
			JSON.stringify(
				{
					schema: 1,
					topic,
					language,
					theme: this.theme,
					test: this.info.title,
					testFile: 'tests/student-journeys.test.ts',
					status: this.info.status,
					commit: process.env.GITHUB_SHA ?? null,
					run: process.env.GITHUB_RUN_ID ?? null,
					segments
				},
				null,
				2
			)
		);
	}
}
