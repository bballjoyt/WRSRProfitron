import { Injectable } from '@angular/core';
import { PricesDataset, ResourcePrice, PricesStore } from './models/prices.model';

@Injectable({
  providedIn: 'root'
})
export class PricesService {
  private readonly PRICES_STORAGE_KEY = 'prices-data-store';
  private readonly WORKDAYS_STORAGE_KEY = 'workdays-pricing';

  constructor() {}

  savePricesData(dataset: PricesDataset): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getPricesStore();

        // Remove existing dataset with same filename (overwritable)
        store.datasets = store.datasets.filter(d => d.filename !== dataset.filename);

        // Add new dataset
        store.datasets.push(dataset);

        // Rebuild the entire resource index to handle name changes
        store.resourceIndex = {};
        store.datasets.forEach(d => {
          d.resources.forEach(resource => {
            store.resourceIndex[resource.name] = resource;
          });
        });

        localStorage.setItem(this.PRICES_STORAGE_KEY, JSON.stringify(store));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  getPricesStore(): PricesStore {
    try {
      const stored = localStorage.getItem(this.PRICES_STORAGE_KEY);
      return stored ? JSON.parse(stored) : { datasets: [], resourceIndex: {} };
    } catch (error) {
      console.error('Error loading prices store:', error);
      return { datasets: [], resourceIndex: {} };
    }
  }

  getAllDatasets(): PricesDataset[] {
    return this.getPricesStore().datasets;
  }

  getResourcePrice(resourceName: string): ResourcePrice | undefined {
    const store = this.getPricesStore();

    // Handle Workdays specially
    if (resourceName.toLowerCase().includes('workday')) {
      const workdaysPricing = this.getWorkdaysPricing();
      if (workdaysPricing.ussrCost > 0 || workdaysPricing.natoCost > 0) {
        return {
          name: 'Workdays',
          prices: {
            ussrSell: 0, // No sell price for workdays
            ussrBuy: workdaysPricing.ussrCost,
            natoSell: 0, // No sell price for workdays
            natoBuy: workdaysPricing.natoCost
          },
          lastUpdated: new Date().toISOString()
        };
      }
    }

    // First try exact match
    let resource = store.resourceIndex[resourceName];

    if (!resource) {
      // Try case-insensitive match
      const lowerCaseName = resourceName.toLowerCase().trim();
      const availableKeys = Object.keys(store.resourceIndex);

      let matchingKey = availableKeys.find(key =>
        key.toLowerCase().trim() === lowerCaseName
      );

      if (!matchingKey) {
        // Try partial matches for common construction materials
        matchingKey = availableKeys.find(key => {
          const keyLower = key.toLowerCase().trim();
          return keyLower.includes(lowerCaseName) || lowerCaseName.includes(keyLower);
        });
      }

      if (matchingKey) {
        resource = store.resourceIndex[matchingKey];
        console.log(`Found match for "${resourceName}" -> "${matchingKey}"`);
      } else {
        console.log(`No price data found for "${resourceName}". Available resources:`, availableKeys);
      }
    }

    return resource;
  }

  getAllResources(): ResourcePrice[] {
    const store = this.getPricesStore();
    return Object.values(store.resourceIndex);
  }

  deleteDataset(filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getPricesStore();
        const dataset = store.datasets.find(d => d.filename === filename);

        if (dataset) {
          // Remove dataset
          store.datasets = store.datasets.filter(d => d.filename !== filename);

          // Rebuild resource index from remaining datasets
          store.resourceIndex = {};
          store.datasets.forEach(d => {
            d.resources.forEach(resource => {
              store.resourceIndex[resource.name] = resource;
            });
          });

          localStorage.setItem(this.PRICES_STORAGE_KEY, JSON.stringify(store));
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
        const store = this.getPricesStore();

        // Remove multiple datasets
        store.datasets = store.datasets.filter(d => !filenames.includes(d.filename));

        // Rebuild resource index from remaining datasets
        store.resourceIndex = {};
        store.datasets.forEach(d => {
          d.resources.forEach(resource => {
            store.resourceIndex[resource.name] = resource;
          });
        });

        localStorage.setItem(this.PRICES_STORAGE_KEY, JSON.stringify(store));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  clearAllPricesData(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        localStorage.removeItem(this.PRICES_STORAGE_KEY);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  deleteResource(resourceName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getPricesStore();

        // Remove resource from all datasets
        store.datasets.forEach(dataset => {
          const originalLength = dataset.resources.length;
          dataset.resources = dataset.resources.filter(r => r.name !== resourceName);

          if (dataset.resources.length !== originalLength) {
            dataset.totalResources = dataset.resources.length;
          }
        });

        // Rebuild resource index completely
        store.resourceIndex = {};
        store.datasets.forEach(dataset => {
          dataset.resources.forEach(resource => {
            store.resourceIndex[resource.name] = resource;
          });
        });

        localStorage.setItem(this.PRICES_STORAGE_KEY, JSON.stringify(store));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  exportPricesData(): string {
    const store = this.getPricesStore();
    return JSON.stringify(store, null, 2);
  }

  // Workdays pricing methods
  getWorkdaysPricing(): {ussrCost: number, natoCost: number} {
    try {
      const stored = localStorage.getItem(this.WORKDAYS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {ussrCost: 0, natoCost: 0};
    } catch (error) {
      console.error('Error loading workdays pricing:', error);
      return {ussrCost: 0, natoCost: 0};
    }
  }

  saveWorkdaysPricing(ussrCost: number, natoCost: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const pricing = {ussrCost, natoCost};
        localStorage.setItem(this.WORKDAYS_STORAGE_KEY, JSON.stringify(pricing));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

}
