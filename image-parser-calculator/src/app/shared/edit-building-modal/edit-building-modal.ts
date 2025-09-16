import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IndustryBuilding, ResourceRequirement, ResourceProduction, ImportSource, ExportTarget } from '../../models/industry.model';

@Component({
  selector: 'app-edit-building-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-building-modal.html',
  styleUrl: './edit-building-modal.css'
})
export class EditBuildingModal implements OnInit {
  @Input() building!: IndustryBuilding;
  @Input() isVisible = false;
  @Output() save = new EventEmitter<IndustryBuilding>();
  @Output() cancel = new EventEmitter<void>();

  editedBuilding!: IndustryBuilding;
  importSourceOptions: ImportSource[] = ['own', 'importNATO', 'importUSSR'];
  exportTargetOptions: ExportTarget[] = ['own', 'exportNATO', 'exportUSSR'];

  ngOnInit(): void {
    if (this.building) {
      this.resetToCurrentValues();
    }
  }

  ngOnChanges(): void {
    if (this.building) {
      this.resetToCurrentValues();
    }
  }

  resetToCurrentValues(): void {
    this.editedBuilding = this.deepClone(this.building);
  }

  resetToOriginalValues(): void {
    if (this.building.originalParsedValues) {
      this.editedBuilding = this.deepClone(this.building.originalParsedValues);
    } else {
      this.resetToCurrentValues();
    }
  }

  onSave(): void {
    this.save.emit(this.editedBuilding);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }

  addInput(): void {
    this.editedBuilding.consumption.inputs.push({
      name: '',
      quantity: 0,
      importSource: 'own'
    });
  }

  removeInput(index: number): void {
    this.editedBuilding.consumption.inputs.splice(index, 1);
  }

  addOutput(): void {
    this.editedBuilding.production.outputs.push({
      name: '',
      quantity: 0,
      exportTarget: 'own'
    });
  }

  removeOutput(index: number): void {
    this.editedBuilding.production.outputs.splice(index, 1);
  }

  addConstructionMaterial(): void {
    this.editedBuilding.constructionCost.materials.push({
      name: '',
      quantity: 0,
      importSource: 'own'
    });
  }

  removeConstructionMaterial(index: number): void {
    this.editedBuilding.constructionCost.materials.splice(index, 1);
  }

  private deepClone(obj: any): any {
    return JSON.parse(JSON.stringify(obj));
  }
}
