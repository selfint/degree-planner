<script lang="ts">
	import { content } from '$lib/preferences.svelte';

	const messages = {
		en: {
			title: 'Install PlanIt',
			intro:
				'Keep PlanIt on your home screen. Open the app, then choose your browser’s install option.',
			open: 'Open PlanIt',
			help: 'Installation and offline access',
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
			help: 'התקנה ושימוש ללא אינטרנט',
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
	class="mx-auto w-full max-w-3xl px-4 py-10 text-content-secondary"
	aria-labelledby="install-title"
	data-testid="landing-install-info"
>
	<h2 id="install-title" class="text-xl font-medium text-content-primary">
		{text.title}
	</h2>
	<p class="mt-2">{text.intro}</p>
	<a
		href="/app/"
		data-sveltekit-reload
		class="mt-3 inline-flex min-h-11 items-center text-link underline"
		>{text.open}</a
	>
	<details class="mt-3">
		<summary class="cursor-pointer">{text.help}</summary>
		<p class="mt-3">{text.install}</p>
		<p class="mt-3">{text.offline}</p>
		<p class="mt-3">{text.storage}</p>
	</details>
</section>
