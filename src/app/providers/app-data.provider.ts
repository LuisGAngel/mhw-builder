import { Injectable } from '@angular/core';
import { Observable, Observer } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { AmmoCapacitiesLoader } from '../data/loaders/ammo-capacities.loader';
import { ArmorLoader } from '../data/loaders/armor.loader';
import { AugmentationsLoader } from '../data/loaders/augmentations.loader';
import { AwakeningsLoader } from '../data/loaders/awakenings.loader';
import { CharmsLoader } from '../data/loaders/charms.loader';
import { DecorationsLoader } from '../data/loaders/decorations.loader';
import { KinsectsLoader } from '../data/loaders/kinsects.loader';
import { MelodiesLoader } from '../data/loaders/melodies.loader';
import { MelodyEffectLoader } from '../data/loaders/melodyEffect.loader';
import { ModificationsLoader } from '../data/loaders/modifications.loader';
import { SetBonusesLoader } from '../data/loaders/set-bonuses.loader';
import { SharpnessModifiersLoader } from '../data/loaders/sharpness-modifiers.loader';
import { SkillsLoader } from '../data/loaders/skills.loader';
import { ToolsLoader } from '../data/loaders/tools.loader';
import { UpgradesLoader } from '../data/loaders/upgrades.loader';
import { WeaponModifiersLoader } from '../data/loaders/weapon-modifiers.loader';
import { WeaponsLoader } from '../data/loaders/weapons.loader';
import { AppDataModel } from '../models/app-data.model';

@Injectable()
export class AppDataProvider {
	public appData: AppDataModel;

	constructor(
		private weaponLoader: WeaponsLoader,
		private armorLoader: ArmorLoader,
		private charmsLoader: CharmsLoader,
		private decorationsLoader: DecorationsLoader,
		private augmentationsLoader: AugmentationsLoader,
		private modificationsLoader: ModificationsLoader,
		private kinsectsLoader: KinsectsLoader,
		private skillsLoader: SkillsLoader,
		private setBonusesLoader: SetBonusesLoader,
		private sharpnessModifiersLoader: SharpnessModifiersLoader,
		private weaponModifiersLoader: WeaponModifiersLoader,
		private ammoCapacitiesLoader: AmmoCapacitiesLoader,
		private melodiesLoader: MelodiesLoader,
		private melodyEffectLoader: MelodyEffectLoader,
		private toolsLoader: ToolsLoader,
		private upgradesLoader: UpgradesLoader,
		private awakeningsLoader: AwakeningsLoader
	) {
		this.appData = new AppDataModel();
	}

	load(): Observable<boolean> {
		return new Observable((observer: Observer<boolean>) => {
			Promise.all([
				lastValueFrom(this.weaponLoader.load('weapons.tsv', false)),
				lastValueFrom(this.armorLoader.load('armor.tsv', false)),
				lastValueFrom(this.charmsLoader.load('charms.tsv', false)),
				lastValueFrom(this.decorationsLoader.load('decorations.tsv', false)),
				lastValueFrom(this.augmentationsLoader.load('augmentations.json', false)),
				lastValueFrom(this.modificationsLoader.load('modifications.json', false)),
				lastValueFrom(this.kinsectsLoader.load('kinsects.tsv', false)),
				lastValueFrom(this.skillsLoader.load('skills.json', false)),
				lastValueFrom(this.setBonusesLoader.load('set-bonuses.json', false)),
				lastValueFrom(this.sharpnessModifiersLoader.load('sharpness-modifiers.json', false)),
			]).then(results => {
				this.appData.weapons = results[0];
				this.appData.armors = results[1];
				this.appData.charms = results[2];
				this.appData.decorations = results[3];
				this.appData.augmentations = results[4];
				this.appData.modifications = results[5];
				this.appData.kinsects = results[6];
				this.appData.skills = results[7];
				this.appData.setBonuses = results[8];
				this.appData.sharpnessModifiers = results[9];

				Promise.all([
					lastValueFrom(this.weaponModifiersLoader.load('weapon-modifiers.json', false)),
					lastValueFrom(this.ammoCapacitiesLoader.load('ammo-capacities.json', false)),
					lastValueFrom(this.melodiesLoader.load('melodies.tsv', false)),
					lastValueFrom(this.melodyEffectLoader.load('melody-effect.tsv', false)),
					lastValueFrom(this.toolsLoader.load('tools.tsv', false)),
					lastValueFrom(this.upgradesLoader.load('upgrades.json', false)),
					lastValueFrom(this.awakeningsLoader.load('awakenings.json', false))
				]).then(results2 => {
					this.appData.weaponModifiers = results2[0];
					this.appData.ammoCapacities = results2[1];
					this.appData.melodies = results2[2];
					this.appData.melodyEffect = results2[3];
					this.appData.tools = results2[4];
					this.appData.upgrades = results2[5];
					this.appData.awakenings = results2[6];

					observer.next(true);
					observer.complete();
				});
			});
		});
	}
}
