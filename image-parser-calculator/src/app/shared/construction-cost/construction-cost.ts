import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IndustryBuilding, ImportSource } from '../../models/industry.model';
import { PricesService } from '../../prices';

@Component({
  selector: 'app-construction-cost',
  imports: [CommonModule, FormsModule],
  templateUrl: './construction-cost.html',
  styleUrl: './construction-cost.css'
})
export class ConstructionCost {
  @Input() building!: IndustryBuilding;
  @Input() showSourceControls = true;
  @Output() importSourceChanged = new EventEmitter<{type: 'construction', index: number, source: ImportSource}>();

  private pricesService = inject(PricesService);

  getResourcePrice(resourceName: string) {
    return this.pricesService.getResourcePrice(resourceName);
  }

  // Buy price methods
  getBuyPriceUSSR(material: any): number {
    const price = this.getResourcePrice(material.name);
    return price?.prices?.ussrBuy || 0;
  }

  getBuyPriceNATO(material: any): number {
    const price = this.getResourcePrice(material.name);
    return price?.prices?.natoBuy || 0;
  }

  // Material cost calculation - Always show both currencies for construction cost analysis
  getMaterialCostUSSR(material: any): number {
    const price = this.getResourcePrice(material.name);
    if (!price?.prices) return 0;
    return material.quantity * (price.prices.ussrBuy || 0);
  }

  getMaterialCostNATO(material: any): number {
    const price = this.getResourcePrice(material.name);
    if (!price?.prices) return 0;
    return material.quantity * (price.prices.natoBuy || 0);
  }

  // Total calculations
  getTotalConstructionCostUSSR(): number {
    let total = 0;
    for (const material of this.building.constructionCost.materials) {
      total += this.getMaterialCostUSSR(material);
    }
    return total;
  }

  getTotalConstructionCostNATO(): number {
    let total = 0;
    for (const material of this.building.constructionCost.materials) {
      total += this.getMaterialCostNATO(material);
    }
    return total;
  }

  // ROI calculations
  getPaybackPeriodDaysUSSR(dailyProfitUSSR: number): number {
    const constructionCost = this.getTotalConstructionCostUSSR();
    if (dailyProfitUSSR <= 0 || constructionCost <= 0) return Infinity;
    return constructionCost / dailyProfitUSSR;
  }

  getPaybackPeriodDaysNATO(dailyProfitNATO: number): number {
    const constructionCost = this.getTotalConstructionCostNATO();
    if (dailyProfitNATO <= 0 || constructionCost <= 0) return Infinity;
    return constructionCost / dailyProfitNATO;
  }

  // Event handlers
  onImportSourceChange(index: number, source: ImportSource): void {
    this.importSourceChanged.emit({type: 'construction', index, source});
  }

  isFinite(value: number): boolean {
    return Number.isFinite(value);
  }
}
