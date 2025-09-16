import { Injectable } from '@angular/core';
import { IndustryDataset, IndustryBuilding, IndustryStore } from './models/industry.model';

@Injectable({
  providedIn: 'root'
})
export class IndustryService {
  private readonly INDUSTRY_STORAGE_KEY = 'industry-data-store';

  constructor() {}

  saveIndustryData(dataset: IndustryDataset, overwriteMode?: 'overwrite' | 'cancel' | 'copy'): Promise<{ success: boolean, action?: string, newName?: string }> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getIndustryStore();
        const existingDataset = store.nameIndex[dataset.userDefinedName];

        if (existingDataset && !overwriteMode) {
          // Name conflict - return status for user decision
          resolve({ success: false, action: 'conflict' });
          return;
        }

        if (existingDataset && overwriteMode === 'cancel') {
          resolve({ success: false, action: 'cancelled' });
          return;
        }

        if (existingDataset && overwriteMode === 'copy') {
          // Generate unique name
          let counter = 1;
          let newName = `${dataset.userDefinedName} (${counter})`;
          while (store.nameIndex[newName]) {
            counter++;
            newName = `${dataset.userDefinedName} (${counter})`;
          }
          dataset.userDefinedName = newName;
        }

        // Remove existing dataset with same user-defined name if overwriting
        if (existingDataset && overwriteMode === 'overwrite') {
          store.datasets = store.datasets.filter(d => d.userDefinedName !== dataset.userDefinedName);
        }

        // Add new dataset
        store.datasets.push(dataset);

        // Update indices
        store.nameIndex[dataset.userDefinedName] = dataset;
        dataset.buildings.forEach(building => {
          store.buildingIndex[building.name] = building;
        });

        localStorage.setItem(this.INDUSTRY_STORAGE_KEY, JSON.stringify(store));
        resolve({
          success: true,
          action: overwriteMode || 'saved',
          newName: overwriteMode === 'copy' ? dataset.userDefinedName : undefined
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  getIndustryStore(): IndustryStore {
    try {
      const stored = localStorage.getItem(this.INDUSTRY_STORAGE_KEY);
      return stored ? JSON.parse(stored) : { datasets: [], buildingIndex: {}, nameIndex: {} };
    } catch (error) {
      console.error('Error loading industry store:', error);
      return { datasets: [], buildingIndex: {}, nameIndex: {} };
    }
  }

  getAllDatasets(): IndustryDataset[] {
    return this.getIndustryStore().datasets;
  }

  getBuildingData(buildingName: string): IndustryBuilding | undefined {
    const store = this.getIndustryStore();
    return store.buildingIndex[buildingName];
  }

  getAllBuildings(): IndustryBuilding[] {
    const store = this.getIndustryStore();
    return Object.values(store.buildingIndex);
  }

  getDatasetByName(userDefinedName: string): IndustryDataset | undefined {
    const store = this.getIndustryStore();
    return store.nameIndex[userDefinedName];
  }

  searchDatasets(searchTerm: string): IndustryDataset[] {
    const store = this.getIndustryStore();
    const term = searchTerm.toLowerCase();
    return store.datasets.filter(dataset =>
      dataset.userDefinedName.toLowerCase().includes(term) ||
      dataset.buildings.some(building =>
        building.name.toLowerCase().includes(term) ||
        building.production.outputs.some(output => output.name.toLowerCase().includes(term)) ||
        building.consumption.inputs.some(input => input.name.toLowerCase().includes(term))
      )
    );
  }

  getAllUserDefinedNames(): string[] {
    const store = this.getIndustryStore();
    return Object.keys(store.nameIndex);
  }

  deleteDataset(filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getIndustryStore();
        const dataset = store.datasets.find(d => d.filename === filename);

        if (dataset) {
          // Remove dataset
          store.datasets = store.datasets.filter(d => d.filename !== filename);

          // Remove from name index
          delete store.nameIndex[dataset.userDefinedName];

          // Rebuild building index from remaining datasets
          store.buildingIndex = {};
          store.datasets.forEach(d => {
            d.buildings.forEach(building => {
              store.buildingIndex[building.name] = building;
            });
          });

          localStorage.setItem(this.INDUSTRY_STORAGE_KEY, JSON.stringify(store));
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  batchDeleteDatasets(filenames: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getIndustryStore();

        // Get datasets to remove for name index cleanup
        const datasetsToRemove = store.datasets.filter(d => filenames.includes(d.filename));

        // Remove multiple datasets
        store.datasets = store.datasets.filter(d => !filenames.includes(d.filename));

        // Remove from name index
        datasetsToRemove.forEach(dataset => {
          delete store.nameIndex[dataset.userDefinedName];
        });

        // Rebuild building index from remaining datasets
        store.buildingIndex = {};
        store.datasets.forEach(d => {
          d.buildings.forEach(building => {
            store.buildingIndex[building.name] = building;
          });
        });

        localStorage.setItem(this.INDUSTRY_STORAGE_KEY, JSON.stringify(store));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  clearAllIndustryData(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        localStorage.removeItem(this.INDUSTRY_STORAGE_KEY);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  updateBuilding(buildingName: string, updatedBuilding: IndustryBuilding): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getIndustryStore();

        // Update building in all datasets where it exists
        store.datasets.forEach(dataset => {
          const buildingIndex = dataset.buildings.findIndex(b => b.name === buildingName);
          if (buildingIndex !== -1) {
            dataset.buildings[buildingIndex] = updatedBuilding;
          }
        });

        // Update building index
        store.buildingIndex[buildingName] = updatedBuilding;

        // If building name changed, update the key in the index
        if (updatedBuilding.name !== buildingName) {
          store.buildingIndex[updatedBuilding.name] = updatedBuilding;
          delete store.buildingIndex[buildingName];
        }

        localStorage.setItem(this.INDUSTRY_STORAGE_KEY, JSON.stringify(store));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  deleteBuilding(buildingName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getIndustryStore();

        // Remove building from all datasets
        store.datasets.forEach(dataset => {
          const originalLength = dataset.buildings.length;
          dataset.buildings = dataset.buildings.filter(b => b.name !== buildingName);

          if (dataset.buildings.length !== originalLength) {
            dataset.totalBuildings = dataset.buildings.length;
          }
        });

        // Rebuild building index completely
        store.buildingIndex = {};
        store.datasets.forEach(dataset => {
          dataset.buildings.forEach(building => {
            store.buildingIndex[building.name] = building;
          });
        });

        localStorage.setItem(this.INDUSTRY_STORAGE_KEY, JSON.stringify(store));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  exportIndustryData(): string {
    const store = this.getIndustryStore();
    return JSON.stringify(store, null, 2);
  }
}