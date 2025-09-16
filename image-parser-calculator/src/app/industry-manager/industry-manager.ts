import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IndustryService } from '../industry';
import { PricesService } from '../prices';
import { IndustryDataset, IndustryBuilding, ImportSource, ExportTarget } from '../models/industry.model';
import { ResourceDetails } from '../shared/resource-details/resource-details';

@Component({
  selector: 'app-industry-manager',
  imports: [CommonModule, FormsModule, ResourceDetails],
  templateUrl: './industry-manager.html',
  styleUrl: './industry-manager.css'
})
export class IndustryManager implements OnInit {
  private industryService = inject(IndustryService);
  private pricesService = inject(PricesService);
  private router = inject(Router);

  datasets: IndustryDataset[] = [];
  buildings: IndustryBuilding[] = [];
  selectedDatasets: string[] = [];
  searchTerm = '';
  filteredDatasets: IndustryDataset[] = [];

  // Table expansion state
  expandedRows: Set<string> = new Set();

  // Building editing
  editingBuilding: IndustryBuilding | null = null;

  // Worker state tracking (snapshot values, reset on page refresh)
  buildingWorkerStates: Map<string, {currentWorkers: number, workerProductivity: number}> = new Map();

  // Get worker state for a building (defaults to max workers and 100% productivity)
  getBuildingWorkerState(building: IndustryBuilding): {currentWorkers: number, workerProductivity: number} {
    const key = building.name;
    if (!this.buildingWorkerStates.has(key)) {
      this.buildingWorkerStates.set(key, {
        currentWorkers: building.maxWorkers || 1,
        workerProductivity: 100
      });
    }
    return this.buildingWorkerStates.get(key)!;
  }

  // Update worker state for a building
  updateBuildingWorkerState(building: IndustryBuilding, currentWorkers?: number, workerProductivity?: number): void {
    const state = this.getBuildingWorkerState(building);
    if (currentWorkers !== undefined) {
      state.currentWorkers = currentWorkers;
    }
    if (workerProductivity !== undefined) {
      state.workerProductivity = workerProductivity;
    }
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.datasets = this.industryService.getAllDatasets();
    this.buildings = this.industryService.getAllBuildings()
      .sort((a, b) => a.name.localeCompare(b.name));

    // Ensure all resources have import sources set
    this.ensureImportSourcesSet();
    this.applyFilters();
  }

  private ensureImportSourcesSet(): void {
    for (const dataset of this.datasets) {
      for (const building of dataset.buildings) {
        // Set default import sources for construction materials
        for (const material of building.constructionCost.materials) {
          if (!material.importSource) {
            material.importSource = 'importUSSR';
          }
        }
        // Set default import sources for inputs
        for (const input of building.consumption.inputs) {
          if (!input.importSource) {
            input.importSource = 'importUSSR';
          }
        }
      }
    }
  }

  applyFilters(): void {
    if (this.searchTerm.trim()) {
      this.filteredDatasets = this.industryService.searchDatasets(this.searchTerm);
    } else {
      this.filteredDatasets = [...this.datasets];
    }
  }

  onSearchChange(): void {
    this.applyFilters();
  }


  async deleteBuilding(buildingName: string): Promise<void> {
    if (!confirm(`Are you sure you want to delete the building "${buildingName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await this.industryService.deleteBuilding(buildingName);
      this.loadData();
    } catch (error) {
      console.error('Error deleting building:', error);
    }
  }

  toggleDatasetSelection(userDefinedName: string): void {
    const index = this.selectedDatasets.indexOf(userDefinedName);
    if (index === -1) {
      this.selectedDatasets.push(userDefinedName);
    } else {
      this.selectedDatasets.splice(index, 1);
    }
  }

  async deleteSelectedDatasets(): Promise<void> {
    if (this.selectedDatasets.length === 0) return;

    const message = `Are you sure you want to delete ${this.selectedDatasets.length} selected dataset(s)? This will remove all associated industry data and cannot be undone.`;

    if (!confirm(message)) {
      return;
    }

    try {
      // Find filenames for selected datasets
      const filenames = this.datasets
        .filter(d => this.selectedDatasets.includes(d.userDefinedName))
        .map(d => d.filename);

      await this.industryService.batchDeleteDatasets(filenames);
      this.selectedDatasets = [];
      this.loadData();
    } catch (error) {
      console.error('Error deleting datasets:', error);
    }
  }

  async clearAllData(): Promise<void> {
    const message = 'Are you sure you want to clear ALL industry data? This will delete everything and cannot be undone.';

    if (!confirm(message)) {
      return;
    }

    try {
      await this.industryService.clearAllIndustryData();
      this.selectedDatasets = [];
      this.loadData();
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  }

  exportData(): void {
    const dataStr = this.industryService.exportIndustryData();
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'industry_data.json';
    link.click();

    URL.revokeObjectURL(url);
  }

  getBuildingByName(name: string): IndustryBuilding | undefined {
    return this.buildings.find(b => b.name === name);
  }

  selectAllDatasets(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.selectedDatasets = target.checked ? this.filteredDatasets.map(d => d.userDefinedName) : [];
  }

  getTotalBuildings(): number {
    return this.buildings.length;
  }


  getResourcePrice(resourceName: string) {
    return this.pricesService.getResourcePrice(resourceName);
  }

  calculateMaterialCost(building: IndustryBuilding, importSource: 'own' | 'importNATO' | 'importUSSR'): number {
    let totalCost = 0;

    for (const material of building.constructionCost.materials) {
      const price = this.getResourcePrice(material.name);
      if (price) {
        let unitCost = 0;
        switch (importSource) {
          case 'importNATO':
            unitCost = price.prices.natoBuy;
            break;
          case 'importUSSR':
            unitCost = price.prices.ussrBuy;
            break;
          case 'own':
            // For 'own', we could use average of sell prices or a different logic
            unitCost = (price.prices.natoSell + price.prices.ussrSell) / 2;
            break;
        }
        totalCost += material.quantity * unitCost;
      }
    }

    return totalCost;
  }

  updateImportSource(building: IndustryBuilding, resourceType: 'material' | 'input', resourceIndex: number, source: 'own' | 'importNATO' | 'importUSSR'): void {
    if (resourceType === 'material') {
      building.constructionCost.materials[resourceIndex].importSource = source;
    } else {
      building.consumption.inputs[resourceIndex].importSource = source;
    }
  }

  getOutputsString(building: IndustryBuilding): string {
    if (!building.production?.outputs?.length) return '';
    return building.production.outputs.map(o => `${o.name} (${o.quantity})`).join(', ');
  }

  // Simplified methods for basic functionality

  selectedBuilding: IndustryBuilding | null = null;

  showBuildingDetails(building: IndustryBuilding): void {
    // Navigate to building details page directly
    this.router.navigate(['/building-details', encodeURIComponent(building.name)]);
  }

  closeBuildingDetails(): void {
    this.selectedBuilding = null;
  }

  getConstructionTotal(building: IndustryBuilding): number {
    let total = 0;
    for (const material of building.constructionCost.materials) {
      const price = this.getResourcePrice(material.name);
      if (price?.prices?.ussrBuy) {
        total += material.quantity * price.prices.ussrBuy;
      }
    }
    return total;
  }

  getConsumptionTotal(building: IndustryBuilding): number {
    let total = 0;
    for (const input of building.consumption.inputs) {
      const price = this.getResourcePrice(input.name);
      if (price?.prices?.ussrBuy) {
        total += input.quantity * price.prices.ussrBuy;
      }
    }
    return total;
  }

  getProductionTotal(building: IndustryBuilding): number {
    let total = 0;
    for (const output of building.production.outputs) {
      const price = this.getResourcePrice(output.name);
      if (price?.prices?.ussrSell) {
        total += output.quantity * price.prices.ussrSell;
      }
    }
    return total;
  }

  // USSR vs NATO comparison methods
  getDailyImportCostUSSR(building: IndustryBuilding): number {
    let total = 0;
    for (const input of building.consumption.inputs) {
      const price = this.getResourcePrice(input.name);
      if (price?.prices && input.importSource === 'importUSSR') {
        total += input.quantity * (price.prices.ussrBuy || 0);
      }
    }
    return total;
  }

  getDailyImportCostNATO(building: IndustryBuilding): number {
    let total = 0;
    for (const input of building.consumption.inputs) {
      const price = this.getResourcePrice(input.name);
      if (price?.prices && input.importSource === 'importNATO') {
        total += input.quantity * (price.prices.natoBuy || 0);
      }
    }
    return total;
  }

  getDailyExportValueUSSR(building: IndustryBuilding): number {
    let total = 0;
    for (const output of building.production.outputs) {
      const price = this.getResourcePrice(output.name);
      if (price?.prices?.ussrSell) {
        total += output.quantity * price.prices.ussrSell;
      }
    }
    return total;
  }

  getDailyExportValueNATO(building: IndustryBuilding): number {
    let total = 0;
    for (const output of building.production.outputs) {
      const price = this.getResourcePrice(output.name);
      if (price?.prices?.natoSell) {
        total += output.quantity * price.prices.natoSell;
      }
    }
    return total;
  }

  getDailyProfitUSSR(building: IndustryBuilding): number {
    return this.getDailyExportValueUSSR(building) - this.getFullDailyImportCostUSSR(building);
  }

  getDailyProfitNATO(building: IndustryBuilding): number {
    return this.getDailyExportValueNATO(building) - this.getFullDailyImportCostNATO(building);
  }

  // Full import cost methods (ignore user selection, assume all imports)
  getFullDailyImportCostUSSR(building: IndustryBuilding): number {
    let total = 0;
    for (const input of building.consumption.inputs) {
      const price = this.getResourcePrice(input.name);
      if (price?.prices?.ussrBuy) {
        total += input.quantity * price.prices.ussrBuy;
      }
    }
    return total;
  }

  getFullDailyImportCostNATO(building: IndustryBuilding): number {
    let total = 0;
    for (const input of building.consumption.inputs) {
      const price = this.getResourcePrice(input.name);
      if (price?.prices?.natoBuy) {
        total += input.quantity * price.prices.natoBuy;
      }
    }
    return total;
  }

  // Profit per worker methods
  getProfitPerWorkerUSSR(building: IndustryBuilding): number {
    const profit = this.getDailyProfitUSSR(building);
    const workers = building.maxWorkers || 1;
    return profit / workers;
  }

  getProfitPerWorkerNATO(building: IndustryBuilding): number {
    const profit = this.getDailyProfitNATO(building);
    const workers = building.maxWorkers || 1;
    return profit / workers;
  }


  // Row expansion methods
  toggleRowExpansion(datasetName: string, buildingName: string): void {
    const rowId = `${datasetName}_${buildingName}`;
    if (this.expandedRows.has(rowId)) {
      this.expandedRows.delete(rowId);
    } else {
      this.expandedRows.add(rowId);
    }
  }

  isRowExpanded(datasetName: string, buildingName: string): boolean {
    const rowId = `${datasetName}_${buildingName}`;
    return this.expandedRows.has(rowId);
  }

  updateImportSourceForResource(building: IndustryBuilding, resourceType: 'construction' | 'input', index: number, newSource: ImportSource): void {
    if (resourceType === 'construction') {
      building.constructionCost.materials[index].importSource = newSource;
    } else {
      building.consumption.inputs[index].importSource = newSource;
    }
  }

  getConstructionMaterialCost(material: any): number {
    const price = this.getResourcePrice(material.name);
    if (!price?.prices) return 0;

    let unitCost = 0;
    switch (material.importSource) {
      case 'importNATO':
        unitCost = price.prices.natoBuy || 0;
        break;
      case 'importUSSR':
        unitCost = price.prices.ussrBuy || 0;
        break;
      case 'own':
        unitCost = 0; // Own resources cost nothing
        break;
    }
    return material.quantity * unitCost;
  }

  getInputResourceCost(input: any): number {
    const price = this.getResourcePrice(input.name);
    if (!price?.prices) return 0;

    let unitCost = 0;
    switch (input.importSource) {
      case 'importNATO':
        unitCost = price.prices.natoBuy || 0;
        break;
      case 'importUSSR':
        unitCost = price.prices.ussrBuy || 0;
        break;
      case 'own':
        unitCost = 0; // Own resources cost nothing
        break;
    }
    return input.quantity * unitCost;
  }

  // Individual input cost methods for the expanded table
  getInputCostUSSR(input: any): number {
    const price = this.getResourcePrice(input.name);
    if (!price?.prices) return 0;

    // Only show cost if this resource is actually sourced from USSR
    if (input.importSource === 'importUSSR') {
      return input.quantity * (price.prices.ussrBuy || 0);
    }
    return 0;
  }

  getInputCostNATO(input: any): number {
    const price = this.getResourcePrice(input.name);
    if (!price?.prices) return 0;

    // Only show cost if this resource is actually sourced from NATO
    if (input.importSource === 'importNATO') {
      return input.quantity * (price.prices.natoBuy || 0);
    }
    return 0;
  }

  // Buy price methods for the expanded table
  getBuyPriceUSSR(input: any): number {
    const price = this.getResourcePrice(input.name);
    return price?.prices?.ussrBuy || 0;
  }

  getBuyPriceNATO(input: any): number {
    const price = this.getResourcePrice(input.name);
    return price?.prices?.natoBuy || 0;
  }

  // Output revenue and sell price methods for production
  getSellPriceUSSR(output: any): number {
    const price = this.getResourcePrice(output.name);
    return price?.prices?.ussrSell || 0;
  }

  getSellPriceNATO(output: any): number {
    const price = this.getResourcePrice(output.name);
    return price?.prices?.natoSell || 0;
  }

  getOutputRevenueUSSR(output: any): number {
    const price = this.getResourcePrice(output.name);
    if (!price?.prices) return 0;

    // Always show potential USSR revenue (quantity × USSR sell price)
    return output.quantity * (price.prices.ussrSell || 0);
  }

  getOutputRevenueNATO(output: any): number {
    const price = this.getResourcePrice(output.name);
    if (!price?.prices) return 0;

    // Always show potential NATO revenue (quantity × NATO sell price)
    return output.quantity * (price.prices.natoSell || 0);
  }

  getDailyRevenueUSSR(building: IndustryBuilding): number {
    let total = 0;
    for (const output of building.production.outputs) {
      total += this.getOutputRevenueUSSR(output);
    }
    return total;
  }

  getDailyRevenueNATO(building: IndustryBuilding): number {
    let total = 0;
    for (const output of building.production.outputs) {
      total += this.getOutputRevenueNATO(output);
    }
    return total;
  }

  updateExportTargetForResource(building: IndustryBuilding, resourceType: 'output', index: number, newTarget: ExportTarget): void {
    if (resourceType === 'output') {
      building.production.outputs[index].exportTarget = newTarget;
    }
  }

  // Event handlers for shared resource details component
  onResourceDetailsChange(building: IndustryBuilding, event: {type: 'input' | 'output', index: number, source?: ImportSource, target?: ExportTarget}): void {
    if (event.type === 'input' && event.source) {
      this.updateImportSourceForResource(building, 'input', event.index, event.source);
    } else if (event.type === 'output' && event.target) {
      this.updateExportTargetForResource(building, 'output', event.index, event.target);
    }
  }

  // Event handlers for worker changes
  onCurrentWorkersChange(building: IndustryBuilding, newWorkers: number): void {
    this.updateBuildingWorkerState(building, newWorkers, undefined);
  }

  onWorkerProductivityChange(building: IndustryBuilding, newProductivity: number): void {
    this.updateBuildingWorkerState(building, undefined, newProductivity);
  }

  // Sorting functionality
  sortField: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  sortBy(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    // Create a flat array of all building-dataset pairs for sorting
    const allBuildingPairs: {building: IndustryBuilding, dataset: IndustryDataset}[] = [];
    this.filteredDatasets.forEach(dataset => {
      dataset.buildings.forEach(building => {
        allBuildingPairs.push({building, dataset});
      });
    });

    // Sort the flat array
    allBuildingPairs.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (field) {
        case 'dataset':
          valueA = a.dataset.userDefinedName;
          valueB = b.dataset.userDefinedName;
          break;
        case 'building':
          valueA = a.building.name;
          valueB = b.building.name;
          break;
        case 'maxWorkers':
          valueA = a.building.maxWorkers || 1;
          valueB = b.building.maxWorkers || 1;
          break;
        case 'dailyCostUSSR':
          valueA = this.getFullDailyImportCostUSSR(a.building);
          valueB = this.getFullDailyImportCostUSSR(b.building);
          break;
        case 'dailyProfitUSSR':
          valueA = this.getDailyProfitUSSR(a.building);
          valueB = this.getDailyProfitUSSR(b.building);
          break;
        case 'profitPerWorkerUSSR':
          valueA = this.getProfitPerWorkerUSSR(a.building);
          valueB = this.getProfitPerWorkerUSSR(b.building);
          break;
        case 'dailyCostNATO':
          valueA = this.getFullDailyImportCostNATO(a.building);
          valueB = this.getFullDailyImportCostNATO(b.building);
          break;
        case 'dailyProfitNATO':
          valueA = this.getDailyProfitNATO(a.building);
          valueB = this.getDailyProfitNATO(b.building);
          break;
        case 'profitPerWorkerNATO':
          valueA = this.getProfitPerWorkerNATO(a.building);
          valueB = this.getProfitPerWorkerNATO(b.building);
          break;
        default:
          return 0;
      }

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return this.sortDirection === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      } else {
        return this.sortDirection === 'asc'
          ? valueA - valueB
          : valueB - valueA;
      }
    });

    // Rebuild the datasets structure from the sorted pairs
    const sortedDatasets: IndustryDataset[] = [];
    const datasetMap = new Map<string, IndustryDataset>();

    allBuildingPairs.forEach(pair => {
      const datasetKey = pair.dataset.userDefinedName;
      if (!datasetMap.has(datasetKey)) {
        const newDataset = { ...pair.dataset, buildings: [] };
        datasetMap.set(datasetKey, newDataset);
        sortedDatasets.push(newDataset);
      }
      datasetMap.get(datasetKey)!.buildings.push(pair.building);
    });

    this.filteredDatasets = sortedDatasets;
  }
}