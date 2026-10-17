import type { Meta, StoryObj } from '@storybook/sveltekit';
import PlanPage from '../../routes/app/(withCourseData)/plan/+page.svelte';
import { courses, getCourseData, pending } from '../../../.storybook/fixtures';
import { baseRouteData, routeState } from './fixtures';

const meta = {
	title: 'Pages/Plan',
	component: PlanPage,
	args: { data: { ...baseRouteData, getCourseData } },
	parameters: {
		componentPath: 'src/routes/app/(withCourseData)/plan/+page.svelte',
		layout: 'fullscreen',
		planner: { plan: 'populated' },
		sveltekit_experimental: routeState('/app/plan')
	}
} satisfies Meta<typeof PlanPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { parameters: { planner: { plan: 'empty' } } };
export const LoadingCourses: Story = {
	args: { data: { ...baseRouteData, getCourseData: () => pending<Course>() } }
};
export const Offline: Story = {
	parameters: { planner: { online: false } }
};
export const UnmetPrerequisites: Story = {
	parameters: {
		planner: {
			user: {
				semesters: [[courses[1].code], [], []],
				wishlist: [courses[0].code, courses[2].code],
				currentSemester: 0
			}
		}
	}
};
export const LongPlan: Story = {
	parameters: {
		planner: {
			user: {
				semesters: [
					[courses[0].code],
					[courses[1].code],
					[],
					[courses[2].code],
					[],
					[],
					[],
					[],
					[]
				],
				wishlist: []
			}
		}
	}
};
