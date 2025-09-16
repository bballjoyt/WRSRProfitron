import { Injectable } from '@angular/core';

export interface ImageData {
  id: string;
  filename: string;
  extractedText: string;
  timestamp: string;
  processed: boolean;
  calculations?: any;
  pricesData?: any; // Contains extracted prices data for Prices files
  industryData?: any; // Contains extracted industry data for Industry files
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private readonly STORAGE_KEY = 'image-parser-data';

  async saveData(data: ImageData): Promise<void> {
    try {
      const existingData = this.getAllData();
      existingData.push(data);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingData));
    } catch (error) {
      console.error('Error saving data:', error);
      throw error;
    }
  }

  getAllData(): ImageData[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error retrieving data:', error);
      return [];
    }
  }

  getDataById(id: string): ImageData | undefined {
    const allData = this.getAllData();
    return allData.find(item => item.id === id);
  }

  updateData(id: string, updatedData: Partial<ImageData>): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const allData = this.getAllData();
        const index = allData.findIndex(item => item.id === id);

        if (index === -1) {
          reject(new Error('Data not found'));
          return;
        }

        allData[index] = { ...allData[index], ...updatedData };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allData));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  deleteData(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const allData = this.getAllData();
        const filteredData = allData.filter(item => item.id !== id);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredData));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  clearAllData(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        localStorage.removeItem(this.STORAGE_KEY);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  exportData(): string {
    const data = this.getAllData();
    return JSON.stringify(data, null, 2);
  }

  importData(jsonString: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const data = JSON.parse(jsonString);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        resolve();
      } catch (error) {
        reject(new Error('Invalid JSON format'));
      }
    });
  }
}
