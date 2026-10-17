<script lang="ts">
	import { content } from '$lib/preferences.svelte';

	const messages = {
		en: {
			title: 'Install PlanIt',
			intro:
				'Keep PlanIt on your home screen. Open the app, then choose your browser’s install option.',
			open: 'Open PlanIt',
			installTitle: 'Add to your home screen',
			offlineTitle: 'Prepare for offline reading',
			storageTitle: 'Your plans and connection',
			install:
				'On iPhone or iPad, open the app in Safari, tap Share and choose Add to Home Screen. On Mac, Safari offers File → Add to Dock. Other browsers offer Install in their menu.',
			offline:
				'The app downloads all courses and the catalog index when you open it. Degree requirements download when you open that degree. Keep the app open while offline access is being prepared.',
			storage:
				'Offline access is read-only. Guest plans stay on this device; account plans and all edits need a connection. Browser and installed-app storage may be separate, especially on iOS. Check your plan before switching.'
		},
		he: {
			title: 'התקנת PlanIt',
			intro:
				'PlanIt במסך הבית שלכם. פתחו את היישום ובחרו באפשרות ההתקנה בתפריט הדפדפן.',
			open: 'פתיחת PlanIt',
			installTitle: 'הוספה למסך הבית',
			offlineTitle: 'הכנה לקריאה ללא אינטרנט',
			storageTitle: 'התוכניות שלכם והחיבור לאינטרנט',
			install:
				'ב-iPhone או ב-iPad, פתחו את היישום ב-Safari, לחצו על שיתוף ובחרו ״הוסף למסך הבית״. ב-Mac אפשר לבחור ב-Safari: קובץ ← הוסף ל-Dock. בדפדפנים אחרים אפשר להתקין דרך התפריט.',
			offline:
				'היישום מוריד את כל הקורסים ואת רשימת הקטלוגים כשפותחים אותו. דרישות התואר יורדות כשפותחים את התואר. השאירו את היישום פתוח בזמן ההכנה לשימוש ללא אינטרנט.',
			storage:
				'ללא אינטרנט אפשר לקרוא בלבד. תוכניות אורח נשארות במכשיר הזה; תוכניות בחשבון וכל העריכות דורשות חיבור. ייתכן שלדפדפן וליישום המותקן יש אחסון נפרד, במיוחד ב-iOS. בדקו שהתוכנית זמינה לפני המעבר.'
		}
	};
	const text = $derived(messages[content.lang.lang]);
</script>

<section
	dir={content.lang.dir}
	class="mx-auto w-full max-w-[64rem] px-5 pb-14 sm:px-6 sm:pb-20"
	aria-labelledby="install-title"
	data-testid="landing-install-info"
>
	<div class="ui-panel p-5 sm:p-8">
		<div class="flex flex-wrap items-start justify-between gap-6">
			<div class="min-w-0 max-w-[35rem]">
				<h2
					id="install-title"
					class="text-2xl font-semibold leading-snug tracking-tight text-content-primary"
				>
					{text.title}
				</h2>
				<p class="mt-3 text-base leading-relaxed text-content-secondary">
					{text.intro}
				</p>
			</div>
			<a
				href="/app/"
				data-sveltekit-reload
				class="ui-button ui-button--primary min-h-11"
			>
				{text.open}
			</a>
		</div>

		<div
			class="mt-7 grid gap-6 border-t border-border pt-6 md:grid-cols-2 md:gap-10"
		>
			<div>
				<h3 class="text-base font-semibold text-content-primary">
					{text.installTitle}
				</h3>
				<p class="mt-2 text-sm leading-relaxed text-content-secondary">
					{text.install}
				</p>
			</div>
			<div>
				<h3 class="text-base font-semibold text-content-primary">
					{text.offlineTitle}
				</h3>
				<p class="mt-2 text-sm leading-relaxed text-content-secondary">
					{text.offline}
				</p>
			</div>
		</div>

		<div class="mt-6 rounded-xl border border-border bg-background/70 p-4">
			<h3 class="text-sm font-semibold text-content-primary">
				{text.storageTitle}
			</h3>
			<p class="mt-1.5 text-sm leading-relaxed text-content-secondary">
				{text.storage}
			</p>
		</div>
	</div>
</section>
