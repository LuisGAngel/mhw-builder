import { Injectable } from '@angular/core';
import { DecorationModel } from '../models/decoration.model';
import { ItemModel } from '../models/item.model';
import { SkillReferenceModel } from '../models/skill-reference.model';
import { DecorationAssignment, SolverResultModel } from '../models/solver-result.model';
import { SkillRequirement, SolverInputModel } from '../models/solver-input.model';
import { DataService } from './data.service';
import { ItemType } from '../types/item.type';

@Injectable()
export class BuildSolverService {

	constructor(private dataService: DataService) { }

	solve(input: SolverInputModel): SolverResultModel[] {
		const maxResults = input.maxResults || 50;

		// 1. Pre-filter armor by rarity, grouped by slot type
		const armorSlots: ItemType[] = [ItemType.Head, ItemType.Chest, ItemType.Arms, ItemType.Waist, ItemType.Legs];
		const candidatesPerSlot: ItemModel[][] = armorSlots.map(type => {
			return this.getCandidates(type, input.rarities, input.requiredSkills);
		});

		// 2. Get charm contribution if specified
		let charmSkills: SkillReferenceModel[] = [];
		let charmItem: ItemModel | null = null;
		if (input.charmId) {
			charmItem = this.dataService.getCharm(input.charmId);
			if (charmItem && charmItem.skills) {
				charmSkills = charmItem.skills.map(s => {
					const level = input.charmLevel != null
						? Math.min(s.level * input.charmLevel, s.level * (charmItem.levels || 1))
						: s.level;
					return { id: s.id, level } as SkillReferenceModel;
				});
			}
		}

		// 3. Get decorations that provide requested skills
		const allDecorations = this.dataService.getDecorations();
		const relevantDecorations = allDecorations.filter(d =>
			d.skills && d.skills.some(ds => input.requiredSkills.some(rs => rs.id === ds.id))
		);

		// 4. Compute max skill contribution possible from decorations per skill
		const maxDecoSkillLevel: { [skillId: string]: number } = {};
		for (const req of input.requiredSkills) {
			const decos = relevantDecorations.filter(d => d.skills && d.skills.some(s => s.id === req.id));
			if (decos.length > 0) {
				const best = decos.reduce((max, d) => {
					const skillRef = d.skills.find(s => s.id === req.id);
					return skillRef && skillRef.level > max ? skillRef.level : max;
				}, 0);
				maxDecoSkillLevel[req.id] = best;
			} else {
				maxDecoSkillLevel[req.id] = 0;
			}
		}

		// 5. Recursive backtracking search
		const results: SolverResultModel[] = [];
		const armorPieces: ItemModel[] = new Array(5);

		const search = (slotIndex: number, accSkills: { [id: string]: number }, weaponSlots: number[]) => {
			if (results.length >= maxResults) {
				return;
			}

			if (slotIndex === 5) {
				// All 5 armor pieces selected — check decoration feasibility
				const allSlots = this.collectSlots(armorPieces, weaponSlots);
				const result = this.tryAssignDecorations(
					input.requiredSkills, accSkills, charmSkills, allSlots, relevantDecorations, armorPieces, charmItem
				);
				if (result) {
					results.push(result);
				}
				return;
			}

			for (const piece of candidatesPerSlot[slotIndex]) {
				armorPieces[slotIndex] = piece;

				// Merge skills
				const newSkills = { ...accSkills };
				if (piece.skills) {
					for (const skill of piece.skills) {
						newSkills[skill.id] = (newSkills[skill.id] || 0) + skill.level;
					}
				}

				// Pruning: check if remaining slots can possibly meet target
				if (this.canPossiblyMeetTarget(input.requiredSkills, newSkills, charmSkills,
					candidatesPerSlot, slotIndex + 1, maxDecoSkillLevel, armorPieces, weaponSlots)) {
					search(slotIndex + 1, newSkills, weaponSlots);
				}
			}
		};

		const initialSkills: { [id: string]: number } = {};
		search(0, initialSkills, input.weaponSlots || []);

		return results;
	}

	private getCandidates(type: ItemType, rarities: number[], requiredSkills: SkillRequirement[]): ItemModel[] {
		const allArmor = this.dataService.getArmorByType(type);
		const filtered = allArmor.filter(a => rarities.includes(a.rarity));

		// Split into skill-relevant and wildcard (big-slot) pieces
		const skillRelevant = filtered.filter(a =>
			a.skills && a.skills.some(s => requiredSkills.some(rs => rs.id === s.id))
		);

		// Wildcard: pieces with no target skills but with decoration slots of size >= 1
		const wildcardIds = new Set(skillRelevant.map(a => a.id));
		const wildcards = filtered.filter(a =>
			!wildcardIds.has(a.id) && a.slots && a.slots.length > 0 && a.slots.some(s => s.level >= 1)
		);

		return [...skillRelevant, ...wildcards];
	}

	private canPossiblyMeetTarget(
		requirements: SkillRequirement[],
		currentSkills: { [id: string]: number },
		charmSkills: SkillReferenceModel[],
		candidatesPerSlot: ItemModel[][],
		nextSlotIndex: number,
		maxDecoSkillLevel: { [skillId: string]: number },
		currentArmor: ItemModel[],
		weaponSlots: number[]
	): boolean {
		for (const req of requirements) {
			let current = currentSkills[req.id] || 0;

			// Add charm contribution
			const charmRef = charmSkills.find(s => s.id === req.id);
			if (charmRef) {
				current += charmRef.level;
			}

			// Estimate max possible from remaining armor slots
			let maxFromArmor = 0;
			for (let i = nextSlotIndex; i < 5; i++) {
				let bestForSlot = 0;
				for (const piece of candidatesPerSlot[i]) {
					if (piece.skills) {
						const ref = piece.skills.find(s => s.id === req.id);
						if (ref && ref.level > bestForSlot) {
							bestForSlot = ref.level;
						}
					}
				}
				maxFromArmor += bestForSlot;
			}

			// Estimate max possible from decorations (generous upper bound: all slots filled)
			let maxSlotCount = 0;
			for (let i = 0; i < nextSlotIndex; i++) {
				if (currentArmor[i] && currentArmor[i].slots && currentArmor[i].slots.length) {
					maxSlotCount += currentArmor[i].slots.length;
				}
			}
			// Remaining armor slots: assume the best
			for (let i = nextSlotIndex; i < 5; i++) {
				maxSlotCount += 3; // generous upper bound per piece
			}
			maxSlotCount += weaponSlots.length;

			const maxFromDecos = maxSlotCount * (maxDecoSkillLevel[req.id] || 0);

			if (current + maxFromArmor + maxFromDecos < req.level) {
				return false;
			}
		}
		return true;
	}

	private collectSlots(armorPieces: ItemModel[], weaponSlots: number[]): number[] {
		const slots: number[] = [];
		for (const piece of armorPieces) {
			if (piece.slots) {
				for (const slot of piece.slots) {
					slots.push(slot.level);
				}
			}
		}
		for (const ws of weaponSlots) {
			slots.push(ws);
		}
		// Sort descending so we assign largest slots first
		slots.sort((a, b) => b - a);
		return slots;
	}

	private tryAssignDecorations(
		requirements: SkillRequirement[],
		armorSkills: { [id: string]: number },
		charmSkills: SkillReferenceModel[],
		availableSlots: number[],
		relevantDecorations: DecorationModel[],
		armorPieces: ItemModel[],
		charmItem: ItemModel | null
	): SolverResultModel | null {
		// Compute remaining skill needs after armor + charm
		const remaining: { id: string; needed: number }[] = [];
		for (const req of requirements) {
			let have = armorSkills[req.id] || 0;
			const charmRef = charmSkills.find(s => s.id === req.id);
			if (charmRef) {
				have += charmRef.level;
			}
			if (have < req.level) {
				remaining.push({ id: req.id, needed: req.level - have });
			}
		}

		if (remaining.length === 0) {
			return this.buildResult(armorPieces, charmItem, [], armorSkills, charmSkills, availableSlots, 0);
		}

		// Build a list of decoration needs
		const decoNeeds: { skillId: string; decoration: DecorationModel; count: number }[] = [];
		for (const rem of remaining) {
			// Find the best decoration for this skill (smallest jewel size that provides the skill)
			const decos = relevantDecorations
				.filter(d => d.skills && d.skills.some(s => s.id === rem.id))
				.sort((a, b) => a.level - b.level);

			if (decos.length === 0) {
				return null; // No decoration can provide this skill
			}

			const best = decos[0];
			const skillRef = best.skills.find(s => s.id === rem.id);
			if (!skillRef) {
				return null;
			}
			const skillPerDeco = skillRef.level;
			const count = Math.ceil(rem.needed / skillPerDeco);
			decoNeeds.push({ skillId: rem.id, decoration: best, count });
		}

		// Sort decoration needs by decoration size descending (assign biggest first)
		const allNeededDecos: DecorationModel[] = [];
		for (const need of decoNeeds) {
			for (let i = 0; i < need.count; i++) {
				allNeededDecos.push(need.decoration);
			}
		}
		allNeededDecos.sort((a, b) => b.level - a.level);

		// Greedy assignment: largest decoration into largest available slot
		const slotsCopy = [...availableSlots];
		const assignments: DecorationAssignment[] = [];
		let slotsUsed = 0;

		for (const deco of allNeededDecos) {
			// Find the smallest slot that fits this decoration
			let bestSlotIdx = -1;
			for (let i = 0; i < slotsCopy.length; i++) {
				if (slotsCopy[i] >= deco.level) {
					if (bestSlotIdx === -1 || slotsCopy[i] < slotsCopy[bestSlotIdx]) {
						bestSlotIdx = i;
					}
				}
			}
			if (bestSlotIdx === -1) {
				return null; // Can't fit this decoration
			}
			assignments.push({ slotSize: slotsCopy[bestSlotIdx], decoration: deco });
			slotsCopy.splice(bestSlotIdx, 1);
			slotsUsed++;
		}

		return this.buildResult(armorPieces, charmItem, assignments, armorSkills, charmSkills, availableSlots, slotsUsed);
	}

	private buildResult(
		armorPieces: ItemModel[],
		charmItem: ItemModel | null,
		decorations: DecorationAssignment[],
		armorSkills: { [id: string]: number },
		charmSkills: SkillReferenceModel[],
		allSlots: number[],
		slotsUsed: number
	): SolverResultModel {
		// Merge all skills
		const skillMap: { [id: string]: number } = { ...armorSkills };
		for (const cs of charmSkills) {
			skillMap[cs.id] = (skillMap[cs.id] || 0) + cs.level;
		}
		for (const da of decorations) {
			for (const s of da.decoration.skills) {
				skillMap[s.id] = (skillMap[s.id] || 0) + s.level;
			}
		}

		const totalSkills: SkillReferenceModel[] = Object.keys(skillMap).map(id => ({
			id,
			level: skillMap[id]
		} as SkillReferenceModel));

		// Calculate total defense (use first value from defense array)
		let totalDefense = 0;
		for (const piece of armorPieces) {
			if (piece.defense && piece.defense.length > 0) {
				totalDefense += piece.defense[0];
			}
		}

		return {
			head: armorPieces[0],
			chest: armorPieces[1],
			arms: armorPieces[2],
			waist: armorPieces[3],
			legs: armorPieces[4],
			charm: charmItem,
			decorations,
			totalSkills,
			totalDefense,
			slotsUsed,
			slotsTotal: allSlots.length
		};
	}
}
