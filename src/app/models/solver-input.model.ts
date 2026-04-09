import { SkillReferenceModel } from './skill-reference.model';

export class SkillRequirement {
	id: string;
	level: number;
}

export class SolverInputModel {
	rarities: number[];
	requiredSkills: SkillRequirement[];
	weaponSlots?: number[];
	charmId?: number;
	charmLevel?: number;
	maxResults?: number;
}
