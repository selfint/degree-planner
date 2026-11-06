import type { Meta, StoryObj } from '@storybook/sveltekit';
import SemesterPage from '../../routes/app/(withCourseData)/semester/+page.svelte';
import { courses, getCourseData, pending } from '../../../.storybook/fixtures';
import { baseRouteData, routeState } from './fixtures';

const meta = {
	title: 'Pages/Semester',
	component: SemesterPage,
	args: { data: { ...baseRouteData, getCourseData } },
	parameters: {
		componentPath: 'src/routes/app/(withCourseData)/semester/+page.svelte',
		layout: 'fullscreen',
		planner: { plan: 'populated' },
		sveltekit_experimental: routeState('/app/semester?c=1')
	}
} satisfies Meta<typeof SemesterPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { parameters: { planner: { plan: 'empty' } } };
export const Loading: Story = {
	args: { data: { ...baseRouteData, getCourseData: () => pending<Course>() } },
	parameters: { planner: { loading: true } }
};
export const FutureSemester: Story = {
	parameters: {
		sveltekit_experimental: routeState('/app/semester?c=2')
	}
};
export const ExamSchedule: Story = {
	parameters: {
		planner: {
			user: {
				semesters: [[], [courses[0].code, courses[1].code], []],
				currentSemester: 1
			}
		}
	}
};
