import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IndustryBuilding, ImportSource, ExportTarget } from '../../models/industry.model';
import { PricesService } from '../../prices';

@Component({
  selector: 'app-resource-details',
  imports: [CommonModule, FormsModule],
  templateUrl: './resource-details.html',
  styleUrl: './resource-details.css'
})
export class ResourceDetails {
  @Input() building!: IndustryBuilding;
  @Input() currentWorkers!: number; // Current number of workers
  @Input() workerProductivity: number = 100; // Worker productivity percentage (30-120%, default 100%)
  @Input() showSourceControls = true; // Whether to show dropdown controls
  @Input() showWorkerControls = false; // Whether to show current workers input
  @Output() importSourceChanged = new EventEmitter<{type: 'input', index: number, source: ImportSource}>();
  @Output() exportTargetChanged = new EventEmitter<{type: 'output', index: number, target: ExportTarget}>();
  @Output() currentWorkersChanged = new EventEmitter<number>();
  @Output() workerProductivityChanged = new EventEmitter<number>();

  private pricesService = inject(PricesService);

  getResourcePrice(resourceName: string) {
    return this.pricesService.getResourcePrice(resourceName);
  }

  // Worker ratio calculation (includes productivity factor, capped at 100%)
  getWorkerRatio(): number {
    const maxWorkers = this.building.maxWorkers || 1;
    const workerRatio = this.currentWorkers / maxWorkers;
    const productivityRatio = this.workerProductivity / 100;
    const totalEfficiency = workerRatio * productivityRatio;

    // Cap total efficiency at 100% (1.0)
    return Math.min(totalEfficiency, 1.0);
  }

  // Scaled quantity based on current workers
  getScaledQuantity(baseQuantity: number): number {
    return baseQuantity * this.getWorkerRatio();
  }

  // Event handler for current workers change
  onCurrentWorkersChange(value: string): void {
    const workers = parseInt(value, 10);
    if (!isNaN(workers) && workers >= 0) {
      this.currentWorkersChanged.emit(workers);
    }
  }

  // Event handler for worker productivity change
  onWorkerProductivityChange(value: string): void {
    const productivity = parseFloat(value);
    if (!isNaN(productivity) && productivity >= 30 && productivity <= 120) {
      this.workerProductivityChanged.emit(productivity);
    }
  }

  // Buy price methods
  getBuyPriceUSSR(input: any): number {
    const price = this.getResourcePrice(input.name);
    return price?.prices?.ussrBuy || 0;
  }

  getBuyPriceNATO(input: any): number {
    const price = this.getResourcePrice(input.name);
    return price?.prices?.natoBuy || 0;
  }

  // Sell price methods
  getSellPriceUSSR(output: any): number {
    const price = this.getResourcePrice(output.name);
    return price?.prices?.ussrSell || 0;
  }

  getSellPriceNATO(output: any): number {
    const price = this.getResourcePrice(output.name);
    return price?.prices?.natoSell || 0;
  }

  // Input cost calculation (scaled by worker ratio)
  getInputCostUSSR(input: any): number {
    const price = this.getResourcePrice(input.name);
    if (!price?.prices) return 0;

    const scaledQuantity = this.getScaledQuantity(input.quantity);
    if (input.importSource === 'importUSSR') {
      return scaledQuantity * (price.prices.ussrBuy || 0);
    }
    return 0;
  }

  getInputCostNATO(input: any): number {
    const price = this.getResourcePrice(input.name);
    if (!price?.prices) return 0;

    const scaledQuantity = this.getScaledQuantity(input.quantity);
    if (input.importSource === 'importNATO') {
      return scaledQuantity * (price.prices.natoBuy || 0);
    }
    return 0;
  }

  // Output revenue calculation (scaled by worker ratio)
  getOutputRevenueUSSR(output: any): number {
    const price = this.getResourcePrice(output.name);
    if (!price?.prices) return 0;
    const scaledQuantity = this.getScaledQuantity(output.quantity);
    return scaledQuantity * (price.prices.ussrSell || 0);
  }

  getOutputRevenueNATO(output: any): number {
    const price = this.getResourcePrice(output.name);
    if (!price?.prices) return 0;
    const scaledQuantity = this.getScaledQuantity(output.quantity);
    return scaledQuantity * (price.prices.natoSell || 0);
  }

  // Total calculations
  getDailyImportCostUSSR(): number {
    let total = 0;
    for (const input of this.building.consumption.inputs) {
      total += this.getInputCostUSSR(input);
    }
    return total;
  }

  getDailyImportCostNATO(): number {
    let total = 0;
    for (const input of this.building.consumption.inputs) {
      total += this.getInputCostNATO(input);
    }
    return total;
  }

  getDailyRevenueUSSR(): number {
    let total = 0;
    for (const output of this.building.production.outputs) {
      total += this.getOutputRevenueUSSR(output);
    }
    return total;
  }

  getDailyRevenueNATO(): number {
    let total = 0;
    for (const output of this.building.production.outputs) {
      total += this.getOutputRevenueNATO(output);
    }
    return total;
  }

  // Net profit calculations (revenue - cost based on user selections)
  getNetProfitUSSR(): number {
    return this.getDailyRevenueUSSR() - this.getDailyImportCostUSSR();
  }

  getNetProfitNATO(): number {
    return this.getDailyRevenueNATO() - this.getDailyImportCostNATO();
  }

  // Event handlers
  onImportSourceChange(index: number, source: ImportSource): void {
    this.importSourceChanged.emit({type: 'input', index, source});
  }

  onExportTargetChange(index: number, target: ExportTarget): void {
    this.exportTargetChanged.emit({type: 'output', index, target});
  }
}