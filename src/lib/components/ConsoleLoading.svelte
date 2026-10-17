<script lang="ts">
	import './console-loading.css';

	type Props = {
		language?: 'en' | 'he';
		phase?: 'courses' | 'opening';
		direction?: 'ltr' | 'rtl';
	};
	const { language = 'en', phase = 'courses', direction }: Props = $props();
	const hebrew = $derived(language === 'he');
	const status = $derived(
		phase === 'courses'
			? hebrew
				? 'טוענים קורסים…'
				: 'Loading courses…'
			: hebrew
				? 'פותחים את PlanIt…'
				: 'Opening PlanIt…'
	);
</script>

<section
	class="console-loading"
	dir={direction ?? (hebrew ? 'rtl' : 'ltr')}
	lang={language}
	aria-label={hebrew ? 'טעינת PlanIt' : 'Loading PlanIt'}
>
	<div class="console-loading__content">
		<div class="console-loading__brand" aria-label="PlanIt">
			<img
				class="console-loading__logo"
				src="/brand/planit-logo.webp"
				width="76"
				height="76"
				alt=""
			/>
			<img
				class="console-loading__wordmark"
				src="/brand/planit-wordmark.svg"
				width="144"
				height="49"
				alt="PlanIt"
			/>
		</div>
		<h1 class="console-loading__title">
			{hebrew ? 'מכינים את סביבת התכנון' : 'Preparing your planner'}
		</h1>
		<p class="console-loading__description">
			{hebrew
				? 'מכינים את קטלוג הקורסים לשימוש במכשיר הזה.'
				: 'Getting the course catalog ready for this device.'}
		</p>
		<div class="console-loading__track" aria-hidden="true">
			<span class="console-loading__indicator"></span>
		</div>
		<p class="console-loading__status" role="status">{status}</p>
	</div>
</section>
