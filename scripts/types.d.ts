export type TreeOnDemandSetResponse = {
	ParentStext: string;
	Short: string;
	HasChildren: boolean;
	HasDetails: boolean;
	IsNotApplicable: boolean;
	SpecialInfo: string;
	HasModules: boolean;
	Otjid: string;
	ParentOtjid: string;
	Otype: string;
	Objid: string;
	Stext: string;
	Cgcat: string;
	Ects: string;
	Invisible: string;
	Vpriox: string;
	Peryr: string;
	Perid: string;
	Orgid: string;
};

export type Track = {
	Otjid: string;
	Peryr: string;
	Perid: SemesterNumber;
	Name: I18N;
	OrgId: string;
	OrgText: I18N;
	ZzQualifications: I18N;
};

export type TreeHead = {
	courses?: string[];
	children?: Tree[];
};

export type Tree = {
	Otjid: string;
	Name: I18N;
	courses?: string[];
	children?: Tree[];
};

export type I18N = {
	en: string;
	he: string;
};

export type Catalog = {
	track: Track;
	tree: TreeHead;
};

export type Degree = Track[];

export type Faculty = {
	Name: I18N;
	PiqYear: string;
	PiqSession: string;
	ZzOrgId: string;
	ZzOrgName: string;
};

export type SemesterNumber = '200' | '201' | '202';

export type SemesterYear = {
	PiqSession: SemesterNumber;
	PiqYear: string;
	IsCurrent: 0 | -1;
};

export type CourseHeader = {
	Otjid: string;
	Peryr: string;
	Perid: string;
};

export type Result<T, E> =
	| {
			status: 'ok';
			value: T;
	  }
	| {
			status: 'err';
			value: E;
	  };
