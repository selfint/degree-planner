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

	type Degree = [string, string, string];

	type Choice = {
		amount: number;
		options: Map<string, Requirement>;
	};

	type ChoiceProgress = {
		amount: [number, number];
		options: Map<string, [Requirement, RequirementProgress]>;
	};

	type Requirement = {
		courses?: string[];
		points?: number;
		count?: number;
		overflow?: string;
		choice?: Choice;
	};

	type ProgressOverflow = [string, 'points' | 'count', number];

	type RequirementProgress = {
		courses?: string[];
		points?: number;
		count?: number;
		overflow?: ProgressOverflow;
		choice?: ChoiceProgress;
	};

	type DegreeRequirements = {
		points: number;
		requirements: Map<string, Requirement>;
	};

	type DegreeProgress = {
		points: [number, number];
		requirements: Map<string, [Requirement, RequirementProgress]>;
	};

	type ChoiceHeader = {
		amount: null;
		[option: string]: RequirementHeader;
	};

	type RequirementHeader = {
		courses?: null;
		points?: null;
		count?: null;
		overflow?: null;
		choice?: ChoiceHeader;
	};

	type RequirementsHeader = Map<string, RequirementHeader>;

	type DegreeData = {
		recommended: string[][];
		requirements: DegreeRequirements;
	};

	type CourseConnections = {
		dependencies: string[][];
		adjacent: string[];
		exclusive: string[];
	};

	type Test = {
		year: number;
		monthIndex: number;
		day: number;
	};

	type StudyDays = {
		first: [Course, Date];
		next: [Course, number][];
	};

	type Course = {
		code: string;
		name?: string;
		points?: number;
		median?: number;
		connections?: CourseConnections;
		about?: string;
		tests?: [Test, Test | null];
		seasons?: CourseSeasons;
	};

	type CourseSeasons =
		| ['Winter', 'Spring', 'Summer']
		| ['Winter', 'Spring']
		| ['Winter', 'Summer']
		| ['Spring', 'Summer']
		| ['Winter']
		| ['Spring']
		| ['Summer'];
	type CourseData = Map<string, Promise<Course>>;
}

export {};
