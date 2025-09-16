import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DatabaseService, ImageData } from '../database';
import { PricesService } from '../prices';
import { IndustryService } from '../industry';

@Component({
  selector: 'app-calculation-results',
  imports: [CommonModule],
  templateUrl: './calculation-results.html',
  styleUrl: './calculation-results.css'
})
export class CalculationResults implements OnInit {
  private databaseService = inject(DatabaseService);
  private pricesService = inject(PricesService);
  private industryService = inject(IndustryService);

  allData: ImageData[] = [];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.allData = this.databaseService.getAllData()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async performCalculations(item: ImageData): Promise<void> {
    try {
      const numbers = this.extractNumbers(item.extractedText);

      if (numbers.length > 0) {
        const calculations = {
          numbers: numbers,
          sum: numbers.reduce((a, b) => a + b, 0),
          average: numbers.reduce((a, b) => a + b, 0) / numbers.length,
          min: Math.min(...numbers),
          max: Math.max(...numbers),
          count: numbers.length
        };

        await this.databaseService.updateData(item.id, {
          calculations: calculations,
          processed: true
        });

        this.loadData();
      } else {
        const calculations = {
          numbers: [],
          message: 'No numbers found in the extracted text'
        };

        await this.databaseService.updateData(item.id, {
          calculations: calculations,
          processed: true
        });

        this.loadData();
      }
    } catch (error) {
      console.error('Error performing calculations:', error);
    }
  }

  private extractNumbers(text: string): number[] {
    // First, handle comma-separated thousands (e.g., "1,885.28" -> "1885.28")
    const normalizedText = text.replace(/(\d+),(\d{3})/g, '$1$2');

    // Match numbers including decimals, but exclude standalone commas
    const numberRegex = /\d+\.?\d*/g;
    const matches = normalizedText.match(numberRegex);
    return matches ? matches.map(n => parseFloat(n)).filter(n => !isNaN(n)) : [];
  }

  async deleteItem(id: string): Promise<void> {
    try {
      await this.databaseService.deleteData(id);
      this.loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  }

  exportItem(item: ImageData): void {
    const dataStr = JSON.stringify(item, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${item.filename}_data.json`;
    link.click();

    URL.revokeObjectURL(url);
  }

  exportAllData(): void {
    const dataStr = this.databaseService.exportData();
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'all_image_data.json';
    link.click();

    URL.revokeObjectURL(url);
  }

  async clearAllData(): Promise<void> {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      try {
        await this.databaseService.clearAllData();
        this.loadData();
      } catch (error) {
        console.error('Error clearing data:', error);
      }
    }
  }

  isPricesFile(item: ImageData): boolean {
    return item.filename.toLowerCase().startsWith('prices') && !!item.pricesData;
  }

  isIndustryFile(item: ImageData): boolean {
    return !item.filename.toLowerCase().startsWith('prices') && !!item.industryData;
  }

  async importToPricesDatabase(item: ImageData): Promise<void> {
    if (!item.pricesData) {
      console.error('No prices data found in item');
      return;
    }

    try {
      await this.pricesService.savePricesData(item.pricesData);
      alert(`Successfully imported ${item.pricesData.totalResources} resources from ${item.filename} to the Prices Database!`);
    } catch (error) {
      console.error('Error importing to prices database:', error);
      alert('Error importing to prices database. Check console for details.');
    }
  }

  async importToIndustryDatabase(item: ImageData): Promise<void> {
    if (!item.industryData) {
      console.error('No industry data found in item');
      return;
    }

    try {
      const result = await this.industryService.saveIndustryData(item.industryData);

      if (result.success) {
        alert(`Successfully imported industry "${item.industryData.userDefinedName}" with ${item.industryData.totalBuildings} buildings to the Industry Database!`);
      } else if (result.action === 'conflict') {
        const confirmed = confirm(`Industry name "${item.industryData.userDefinedName}" already exists. Overwrite?`);
        if (confirmed) {
          const overwriteResult = await this.industryService.saveIndustryData(item.industryData, 'overwrite');
          if (overwriteResult.success) {
            alert(`Successfully overwritten industry "${item.industryData.userDefinedName}" in the Industry Database!`);
          }
        }
      }
    } catch (error) {
      console.error('Error importing to industry database:', error);
      alert('Error importing to industry database. Check console for details.');
    }
  }

  getOutputNames(building: any): string {
    if (!building.production?.outputs?.length) return '';
    return building.production.outputs.map((o: any) => o.name).join(', ');
  }

  getInputNames(building: any): string {
    if (!building.consumption?.inputs?.length) return '';
    return building.consumption.inputs.map((i: any) => i.name).join(', ');
  }
}
