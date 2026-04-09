import { DecorationModel } from './decoration.model';
import { ItemModel } from './item.model';
import { SkillReferenceModel } from './skill-reference.model';

export class DecorationAssignment {
	slotSize: number;
	decoration: DecorationModel;
}

export class SolverResultModel {
	head: ItemModel;
	chest: ItemModel;
	arms: ItemModel;
	waist: ItemModel;
	legs: ItemModel;
	charm?: ItemModel;
	decorations: DecorationAssignment[];
	totalSkills: SkillReferenceModel[];
	totalDefense: number;
	slotsUsed: number;
	slotsTotal: number;
}
