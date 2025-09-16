import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IndustryService } from '../industry';
import { PricesService } from '../prices';
import { IndustryBuilding, ImportSource, ExportTarget } from '../models/industry.model';
import { ResourceDetails } from '../shared/resource-details/resource-details';
import { ProfitStats } from '../shared/profit-stats/profit-stats';
import { ConstructionCost } from '../shared/construction-cost/construction-cost';
import { EditBuildingModal } from '../shared/edit-building-modal/edit-building-modal';

@Component({
  selector: 'app-building-details',
  imports: [CommonModule, ResourceDetails, ProfitStats, ConstructionCost, EditBuildingModal],
  templateUrl: './building-details.html',
  styleUrl: './building-details.css'
})
export class BuildingDetails implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private industryService = inject(IndustryService);
  private pricesService = inject(PricesService);

  building: IndustryBuilding | null = null;
  currentWorkers: number = 0;
  workerProductivity: number = 100; // Default 100% productivity
  loading = true;
  error: string | null = null;
  showEditModal = false;

  ngOnInit(): void {
    const buildingName = this.route.snapshot.paramMap.get('name');
    if (buildingName) {
      this.loadBuilding(decodeURIComponent(buildingName));
    } else {
      this.error = 'No building name provided';
      this.loading = false;
    }
  }

  loadBuilding(name: string): void {
    const buildingData = this.industryService.getBuildingData(name);
    this.building = buildingData || null;
    if (!this.building) {
      this.error = `Building "${name}" not found`;
    } else {
      // Initialize currentWorkers to maxWorkers
      this.currentWorkers = this.building.maxWorkers || 1;
    }
    this.loading = false;
  }

  goBack(): void {
    console.log('goBack() called - navigating to root');
    this.router.navigate(['/']).then(success => {
      console.log('Navigation result:', success);
    });
  }


  // Event handlers for shared components
  onResourceDetailsChange(event: {type: 'input' | 'output', index: number, source?: ImportSource, target?: ExportTarget}): void {
    if (!this.building) return;

    if (event.type === 'input' && event.source) {
      this.building.consumption.inputs[event.index].importSource = event.source;
    } else if (event.type === 'output' && event.target) {
      this.building.production.outputs[event.index].exportTarget = event.target;
    }
  }

  onConstructionCostChange(event: {type: 'construction', index: number, source: ImportSource}): void {
    if (!this.building) return;

    if (event.type === 'construction') {
      this.building.constructionCost.materials[event.index].importSource = event.source;
    }
  }

  onCurrentWorkersChange(newWorkers: number): void {
    if (this.building && newWorkers >= 0 && newWorkers <= (this.building.maxWorkers || 1)) {
      this.currentWorkers = newWorkers;
    }
  }

  onWorkerProductivityChange(newProductivity: number): void {
    if (newProductivity >= 30 && newProductivity <= 120) {
      this.workerProductivity = newProductivity;
    }
  }

  openEditModal(): void {
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
  }

  onSaveBuilding(updatedBuilding: IndustryBuilding): void {
    if (this.building) {
      // Store the original values if not already stored
      if (!this.building.originalParsedValues) {
        this.building.originalParsedValues = this.deepClone(this.building);
      }

      // Update the building with edited values
      Object.assign(this.building, updatedBuilding);

      // Update the building in the industry service
      this.industryService.updateBuilding(this.building.name, this.building);

      // Update current workers if it exceeds the new maxWorkers
      if (this.currentWorkers > (this.building.maxWorkers || 1)) {
        this.currentWorkers = this.building.maxWorkers || 1;
      }
    }

    this.closeEditModal();
  }

  private deepClone(obj: any): any {
    return JSON.parse(JSON.stringify(obj));
  }
}