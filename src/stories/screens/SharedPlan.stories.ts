import type { Meta, StoryObj } from '@storybook/sveltekit';
import SharedPlanPage from '../../routes/app/(withCourseData)/preview/[year]/[faculty]/[path]/+page.svelte';
import {
	courses,
	getCourseData,
	pending,
	sampleDegree
} from '../../../.storybook/fixtures';
import { baseRouteData, routeState } from './fixtures';

const data = {
	...baseRouteData,
	getCourseData,
	degree: sampleDegree,
	userPath: undefined,
	semesters: [[courses[0].code], [courses[1].code], [courses[2].code]]
};
const meta = {
	title: 'Pages/Shared plan',
	component: SharedPlanPage,
	args: { data },
	parameters: {
		componentPath:
			'src/routes/app/(withCourseData)/preview/[year]/[faculty]/[path]/+page.svelte',
		planner: { plan: 'empty' },
		sveltekit_experimental: routeState(
			`/app/preview/${sampleDegree.join('/')}`,
			{ year: sampleDegree[0], faculty: sampleDegree[1], path: sampleDegree[2] }
		)
	}
} satisfies Meta<typeof SharedPlanPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = {
	args: { data: { ...data, semesters: [] } }
};
export const Loading: Story = {
	args: { data: { ...data, getCourseData: () => pending<Course>() } },
	parameters: { planner: { loading: true } }
};
export const ReadOnly: Story = {
	parameters: { planner: { online: false } }
};
