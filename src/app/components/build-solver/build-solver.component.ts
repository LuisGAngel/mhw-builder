import { Component, OnInit } from '@angular/core';
import { DataService } from '../../services/data.service';
import { BuildSolverService } from '../../services/build-solver.service';
import { SkillModel } from '../../models/skill.model';
import { SkillRequirement, SolverInputModel } from '../../models/solver-input.model';
import { SolverResultModel } from '../../models/solver-result.model';
import { ItemModel } from '../../models/item.model';
import { SlotService } from '../../services/slot.service';
import { WeaponType } from '../../types/weapon.type';
import { ItemType } from '../../types/item.type';

@Component({
	standalone: false,
	selector: 'mhw-builder-build-solver',
	templateUrl: './build-solver.component.html',
	styleUrls: ['./build-solver.component.scss']
})
export class BuildSolverComponent implements OnInit {

	allSkills: SkillModel[] = [];
	filteredSkills: SkillModel[] = [];
	charms: ItemModel[] = [];
	weapons: ItemModel[] = [];
	weaponTypes = Object.values(WeaponType);
	selectedWeaponType: WeaponType | null = null;
	selectedWeaponId: number | null = null;
	filteredWeapons: ItemModel[] = [];

	// Input state
	rarities: { value: number; checked: boolean }[] = [
		{ value: 9, checked: false },
		{ value: 10, checked: false },
		{ value: 11, checked: true },
		{ value: 12, checked: true }
	];

	requiredSkills: { skill: SkillModel; level: number }[] = [];
	selectedCharmId: number | null = null;
	selectedCharmLevel: number = 1;

	// Skill search
	skillSearchText = '';

	// Results
	results: SolverResultModel[] = [];
	isSearching = false;
	searchDone = false;
	errorMessage = '';

	constructor(
		private dataService: DataService,
		private solverService: BuildSolverService,
		private slotService: SlotService
	) { }

	ngOnInit(): void {
		this.allSkills = this.dataService.getAllSkills();
		this.charms = this.dataService.getCharms();
		this.weapons = this.dataService.getWeapons();
	}

	onWeaponTypeChange(): void {
		if (this.selectedWeaponType) {
			this.filteredWeapons = this.weapons.filter(w => w.weaponType === this.selectedWeaponType);
		} else {
			this.filteredWeapons = [];
		}
		this.selectedWeaponId = null;
	}

	onSkillSearch(text: string): void {
		this.skillSearchText = text;
		if (!text || text.length < 2) {
			this.filteredSkills = [];
			return;
		}
		const lower = text.toLowerCase();
		this.filteredSkills = this.allSkills.filter(s =>
			s.name.toLowerCase().includes(lower)
			&& !this.requiredSkills.some(rs => rs.skill.id === s.id)
		).slice(0, 10);
	}

	addSkill(skill: SkillModel): void {
		this.requiredSkills.push({ skill, level: 1 });
		this.skillSearchText = '';
		this.filteredSkills = [];
	}

	removeSkill(index: number): void {
		this.requiredSkills.splice(index, 1);
	}

	increaseLevel(index: number): void {
		const entry = this.requiredSkills[index];
		const maxLevel = entry.skill.levels ? entry.skill.levels.length : 7;
		if (entry.level < maxLevel) {
			entry.level++;
		}
	}

	decreaseLevel(index: number): void {
		if (this.requiredSkills[index].level > 1) {
			this.requiredSkills[index].level--;
		}
	}

	toggleRarity(rarity: { value: number; checked: boolean }): void {
		rarity.checked = !rarity.checked;
	}

	runSearch(): void {
		this.errorMessage = '';
		this.results = [];
		this.searchDone = false;

		const selectedRarities = this.rarities.filter(r => r.checked).map(r => r.value);
		if (selectedRarities.length === 0) {
			this.errorMessage = 'Select at least one rarity level.';
			return;
		}
		if (this.requiredSkills.length === 0) {
			this.errorMessage = 'Add at least one skill requirement.';
			return;
		}

		const input: SolverInputModel = {
			rarities: selectedRarities,
			requiredSkills: this.requiredSkills.map(rs => ({
				id: rs.skill.id,
				level: rs.level
			} as SkillRequirement)),
			maxResults: 50
		};

		if (this.selectedCharmId) {
			input.charmId = this.selectedCharmId;
			input.charmLevel = this.selectedCharmLevel;
		}

		// Pass weapon decoration slots if a weapon is selected
		let selectedWeapon: ItemModel | null = null;
		if (this.selectedWeaponId) {
			selectedWeapon = this.weapons.find(w => w.id === this.selectedWeaponId) || null;
			if (selectedWeapon && selectedWeapon.slots) {
				input.weaponSlots = selectedWeapon.slots.map(s => s.level);
			}
		}

		this.isSearching = true;

		// Run async via setTimeout to let UI update
		setTimeout(() => {
			try {
				this.results = this.solverService.solve(input);
				// Attach selected weapon to results
				if (selectedWeapon) {
					for (const result of this.results) {
						result.weapon = selectedWeapon;
					}
				}
			} catch (e) {
				this.errorMessage = 'Search failed: ' + ((e as any).message || e);
			}
			this.isSearching = false;
			this.searchDone = true;
		}, 50);
	}

	getSkillName(skillId: string): string {
		const skill = this.dataService.getSkill(skillId);
		return skill ? skill.name : skillId;
	}

	selectResult(result: SolverResultModel): void {
		// Load weapon
		if (result.weapon) {
			const weapon = Object.assign({}, result.weapon);
			weapon.equipmentCategory = 'Weapon' as any;
			this.slotService.selectedItemSlot = this.slotService.weaponSlot;
			this.slotService.selectItem(weapon, false);
		}

		// Load armor pieces
		const armorPieces = [
			{ piece: result.head, type: ItemType.Head },
			{ piece: result.chest, type: ItemType.Chest },
			{ piece: result.arms, type: ItemType.Arms },
			{ piece: result.waist, type: ItemType.Waist },
			{ piece: result.legs, type: ItemType.Legs },
		];

		for (const entry of armorPieces) {
			if (entry.piece) {
				const item = Object.assign({}, entry.piece);
				this.slotService.selectArmorItemByType(item, false, false);
			}
		}

		// Load charm
		if (result.charm) {
			const charm = Object.assign({}, result.charm);
			charm.equippedLevel = charm.levels;
			this.slotService.selectedItemSlot = this.slotService.charmSlot;
			this.slotService.selectItem(charm, false);
		}
	}
}
