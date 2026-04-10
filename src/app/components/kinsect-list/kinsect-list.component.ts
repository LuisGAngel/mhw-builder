import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import * as _ from 'lodash';
import { ElementType } from 'src/app/types/element.type';
import { KinsectModel } from '../../models/kinsect.model';
import { DataService } from '../../services/data.service';
import { SlotService } from '../../services/slot.service';

@Component({
	standalone: false,
	selector: 'mhw-builder-kinsect-list',
	templateUrl: './kinsect-list.component.html',
	styleUrls: ['./kinsect-list.component.scss']
})
export class KinsectListComponent implements OnInit {
	onlyIceborne = true;

	@ViewChild('searchBox', { static: true }) searchBox: ElementRef;

	kinsects: KinsectModel[];
	kinsectsWorld: KinsectModel[];
	kinsectsIceborne: KinsectModel[];
	filteredKinsects: KinsectModel[];

	showSortContainer = true;
	sortType = '';

	@HostListener('window:resize')
	onResize() {
	}

	constructor(
		private slotService: SlotService,
		private dataService: DataService
	) { }

	ngOnInit() {
		this.loadKinsects();
	}

	loadKinsects() {
		this.kinsects = this.dataService.getKinsects();
		this.kinsectsWorld = this.kinsects.filter(item => item.id <= 100);
		this.kinsectsIceborne = this.kinsects.filter(item => item.id > 100);
		this.resetSearchResults();
	}

	search(query: string) {
		this.applyIceborneFilter();

		if (query) {
			query = query.toLocaleLowerCase().trim();

			this.filteredKinsects = _.filter(this.filteredKinsects, (k: KinsectModel) =>
				k.name.toLocaleLowerCase().includes(query) ||
				k.attackType.toString().toLocaleLowerCase().includes(query) ||
				k.dustEffect.toString().toLocaleLowerCase().includes(query));
		} else {
			this.resetSearchResults();
		}
	}

	resetSearchResults() {
		this.searchBox.nativeElement.value = null;
		this.applyIceborneFilter();
		this.sortType = '';
	}

	applyIceborneFilter() {
		if (this.onlyIceborne) {
			this.filteredKinsects = this.kinsectsIceborne;
		} else {
			this.filteredKinsects = this.kinsectsIceborne.concat(this.kinsectsWorld);
		}
	}

	setOnlyIceborne() {
		this.onlyIceborne = !this.onlyIceborne;
		this.applyIceborneFilter();
	}

	selectKinsect(kinsect: KinsectModel) {
		const newKinsect = Object.assign({}, kinsect);
		newKinsect.element = ElementType.None;
		this.slotService.selectKinsect(newKinsect);
	}

	sortByProperty(property: string) {
		this.sortType = property;
		this.filteredKinsects.sort(function (a, b) {
			if (a[property] > b[property]) {
				return -1;
			} else if (a[property] < b[property]) {
				return 1;
			} else {
				return 0;
			}
		});
	}
}
