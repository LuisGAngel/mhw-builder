import { NgModule } from '@angular/core';
import { CommonModule as NgCommonModule } from '@angular/common';
import { DropdownComponent } from './dropdown/dropdown.component';
import { ModalComponent } from './modal/modal.component';

@NgModule({
	imports: [
		NgCommonModule
	],
	declarations: [
		DropdownComponent,
		ModalComponent
	],
	exports: [
		NgCommonModule,
		DropdownComponent,
		ModalComponent
	]
})
export class CommonModule { }
