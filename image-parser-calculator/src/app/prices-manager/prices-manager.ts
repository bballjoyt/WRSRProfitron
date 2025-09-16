import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PricesService } from '../prices';
import { ResourcePrice, PricesDataset } from '../models/prices.model';

@Component({
  selector: 'app-prices-manager',
  imports: [CommonModule, FormsModule],
  templateUrl: './prices-manager.html',
  styleUrl: './prices-manager.css'
})
export class PricesManager implements OnInit {
  private pricesService = inject(PricesService);

  datasets: PricesDataset[] = [];
  resources: ResourcePrice[] = [];
  editingResource: ResourcePrice | null = null;
  originalResourceName: string = '';
  selectedDatasets: string[] = [];

  // Workdays pricing
  workdaysUSSRCost: number = 0;
  workdaysNATOCost: number = 0;

  // Search functionality
  searchTerm: string = '';
  filteredResources: ResourcePrice[] = [];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.datasets = this.pricesService.getAllDatasets();
    this.resources = this.pricesService.getAllResources()
      .sort((a, b) => a.name.localeCompare(b.name));

    // Load workdays pricing
    const workdaysPricing = this.pricesService.getWorkdaysPricing();
    this.workdaysUSSRCost = workdaysPricing.ussrCost;
    this.workdaysNATOCost = workdaysPricing.natoCost;

    // Apply search filter
    this.applySearchFilter();
  }

  editResource(resource: ResourcePrice): void {
    this.editingResource = { ...resource }; // Create a copy for editing
    this.originalResourceName = resource.name; // Track original name for updates
  }

  async saveResource(): Promise<void> {
    if (!this.editingResource || !this.originalResourceName) return;

    try {
      console.log('Saving resource:', {
        originalName: this.originalResourceName,
        newName: this.editingResource.name,
        editingResource: this.editingResource
      });

      // Find which dataset contains this resource and update it
      // Use the original resource name to find the resource in datasets
      let resourceFound = false;
      for (const dataset of this.datasets) {
        const resourceIndex = dataset.resources.findIndex(r => r.name === this.originalResourceName);
        if (resourceIndex !== -1) {
          console.log('Found resource in dataset:', dataset.filename, 'at index:', resourceIndex);

          // Update the resource with new data (including potentially new name)
          dataset.resources[resourceIndex] = {
            ...this.editingResource,
            lastUpdated: new Date().toISOString()
          };

          console.log('Updated resource:', dataset.resources[resourceIndex]);
          await this.pricesService.savePricesData(dataset);
          resourceFound = true;
          break;
        }
      }

      if (!resourceFound) {
        console.error('Resource not found in any dataset:', this.originalResourceName);
      }

      this.editingResource = null;
      this.originalResourceName = '';
      this.loadData();
    } catch (error) {
      console.error('Error saving resource:', error);
    }
  }

  cancelEdit(): void {
    this.editingResource = null;
    this.originalResourceName = '';
  }

  async deleteResource(resourceName: string): Promise<void> {
    if (!confirm(`Are you sure you want to delete the resource "${resourceName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await this.pricesService.deleteResource(resourceName);
      this.loadData();
    } catch (error) {
      console.error('Error deleting resource:', error);
    }
  }

  toggleDatasetSelection(filename: string): void {
    const index = this.selectedDatasets.indexOf(filename);
    if (index === -1) {
      this.selectedDatasets.push(filename);
    } else {
      this.selectedDatasets.splice(index, 1);
    }
  }

  async deleteSelectedDatasets(): Promise<void> {
    if (this.selectedDatasets.length === 0) return;

    const message = `Are you sure you want to delete ${this.selectedDatasets.length} selected dataset(s)? This will remove all associated price data and cannot be undone.`;

    if (!confirm(message)) {
      return;
    }

    try {
      await this.pricesService.batchDeleteDatasets(this.selectedDatasets);
      this.selectedDatasets = [];
      this.loadData();
    } catch (error) {
      console.error('Error deleting datasets:', error);
    }
  }

  async clearAllData(): Promise<void> {
    const message = 'Are you sure you want to clear ALL prices data? This will delete everything and cannot be undone.';

    if (!confirm(message)) {
      return;
    }

    try {
      await this.pricesService.clearAllPricesData();
      this.selectedDatasets = [];
      this.loadData();
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  }

  exportData(): void {
    const dataStr = this.pricesService.exportPricesData();
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'prices_data.json';
    link.click();

    URL.revokeObjectURL(url);
  }

  getResourceByName(name: string): ResourcePrice | undefined {
    return this.resources.find(r => r.name === name);
  }

  selectAllDatasets(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.selectedDatasets = target.checked ? this.datasets.map(d => d.filename) : [];
  }

  getAverageNatoSell(): number {
    if (this.resources.length === 0) return 0;
    return this.resources.reduce((sum, r) => sum + r.prices.natoSell, 0) / this.resources.length;
  }

  getAverageUssrSell(): number {
    if (this.resources.length === 0) return 0;
    return this.resources.reduce((sum, r) => sum + r.prices.ussrSell, 0) / this.resources.length;
  }

  // Workdays pricing methods
  async saveWorkdaysPricing(): Promise<void> {
    try {
      await this.pricesService.saveWorkdaysPricing(this.workdaysUSSRCost, this.workdaysNATOCost);
      console.log('Workdays pricing saved successfully');
    } catch (error) {
      console.error('Error saving workdays pricing:', error);
    }
  }

  resetWorkdaysPricing(): void {
    this.workdaysUSSRCost = 0;
    this.workdaysNATOCost = 0;
  }

  // Search functionality
  applySearchFilter(): void {
    if (this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase().trim();
      this.filteredResources = this.resources.filter(resource =>
        resource.name.toLowerCase().includes(searchLower)
      );
    } else {
      this.filteredResources = [...this.resources];
    }
  }

  onSearchChange(): void {
    this.applySearchFilter();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applySearchFilter();
  }
}
