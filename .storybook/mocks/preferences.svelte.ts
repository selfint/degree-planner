import { cms } from '../../src/lib/content';

// Never read or write the actual planner's localStorage or IndexedDB.
export const content = $state({ lang: cms.en });
