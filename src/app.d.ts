// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	type Year = {
		name: string;
		winter: string[];
		summer: string[];
		spring: string[];
	};

	type CourseConnections = {
		dependencies: string[][];
		adjacent: string[];
		exclusive: string[];
	};

	type CourseInfo = {
		median: number | undefined;
		name: string | undefined;
		points: number | undefined;
		connections: CourseConnections | undefined;
	};

	type Course = {
		code: string;
		info: CourseInfo | undefined;
	};

	type Group = {
		name: string;
		points: number;
		courses: Course[];
	};
}

export {};
