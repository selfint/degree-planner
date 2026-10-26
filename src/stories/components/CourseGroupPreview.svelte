<script lang="ts">
	import CourseGroup from '../../routes/app/(withCourseData)/catalog/components/CourseGroup.svelte';
	import {
		courses,
		getCourseData,
		pending,
		requirementFixture
	} from '../../../.storybook/fixtures';
	let { state = 'default' }: { state?: string } = $props();
	const manyCourses: Course[] = Array.from({ length: 35 }, (_, i) => ({
		...courses[i % courses.length],
		code: `9000${String(i).padStart(4, '0')}` as CourseCode,
		name: `Fictional grouped course ${i + 1}`,
		median: 60 + i
	}));
	const getData = $derived(
		state === 'multipleGroups'
			? async (code: CourseCode) => manyCourses.find((c) => c.code === code)!
			: state === 'loading'
				? () => pending<Course>()
				: state === 'error'
					? async () => {
							throw new Error('Fictional data load failure');
						}
					: getCourseData
	);
</script>

<CourseGroup
	getCourseData={getData}
	titles={[requirementFixture.nested![0]]}
	codes={state === 'empty'
		? []
		: (state === 'multipleGroups' ? manyCourses : courses).map((c) => c.code)}
/>
