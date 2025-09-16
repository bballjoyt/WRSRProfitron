import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IndustryBuilding } from '../../models/industry.model';
import { PricesService } from '../../prices';

@Component({
  selector: 'app-profit-stats',
  imports: [CommonModule],
  templateUrl: './profit-stats.html',
  styleUrl: './profit-stats.css'
})
export class ProfitStats {
  @Input() building!: IndustryBuilding;
  @Input() maxWorkers: number = 1; // Default to 1 if not provided
  @Input() currentWorkers: number = 1; // Current number of workers
  @Input() workerProductivity: number = 100; // Worker productivity percentage (30-120%, default 100%)

  private pricesService = inject(PricesService);

  // Calculate worker efficiency ratio (includes productivity factor, capped at 100%)
  getWorkerRatio(): number {
    const maxWorkers = this.building.maxWorkers || 1;
    const workerRatio = this.currentWorkers / maxWorkers;
    const productivityRatio = this.workerProductivity / 100;
    const totalEfficiency = workerRatio * productivityRatio;

    // Cap total efficiency at 100% (1.0)
    return Math.min(totalEfficiency, 1.0);
  }

  getResourcePrice(resourceName: string) {
    return this.pricesService.getResourcePrice(resourceName);
  }

  // Calculate daily costs (USSR) scaled by worker ratio
  getDailyCostsUSSR(): number {
    let total = 0;
    const workerRatio = this.getWorkerRatio();
    for (const input of this.building.consumption.inputs) {
      const price = this.getResourcePrice(input.name);
      if (price?.prices && input.importSource === 'importUSSR') {
        total += (input.quantity * workerRatio) * (price.prices.ussrBuy || 0);
      }
    }
    return total;
  }

  // Calculate daily costs (NATO) scaled by worker ratio
  getDailyCostsNATO(): number {
    let total = 0;
    const workerRatio = this.getWorkerRatio();
    for (const input of this.building.consumption.inputs) {
      const price = this.getResourcePrice(input.name);
      if (price?.prices && input.importSource === 'importNATO') {
        total += (input.quantity * workerRatio) * (price.prices.natoBuy || 0);
      }
    }
    return total;
  }

  // Calculate daily revenue (USSR) scaled by worker ratio
  getDailyRevenueUSSR(): number {
    let total = 0;
    const workerRatio = this.getWorkerRatio();
    for (const output of this.building.production.outputs) {
      const price = this.getResourcePrice(output.name);
      if (price?.prices?.ussrSell) {
        total += (output.quantity * workerRatio) * price.prices.ussrSell;
      }
    }
    return total;
  }

  // Calculate daily revenue (NATO) scaled by worker ratio
  getDailyRevenueNATO(): number {
    let total = 0;
    const workerRatio = this.getWorkerRatio();
    for (const output of this.building.production.outputs) {
      const price = this.getResourcePrice(output.name);
      if (price?.prices?.natoSell) {
        total += (output.quantity * workerRatio) * price.prices.natoSell;
      }
    }
    return total;
  }

  // Profit calculations for USSR
  getDailyProfitUSSR(): number {
    return this.getDailyRevenueUSSR() - this.getDailyCostsUSSR();
  }

  getMonthlyProfitUSSR(): number {
    return this.getDailyProfitUSSR() * 30;
  }

  getYearlyProfitUSSR(): number {
    return this.getDailyProfitUSSR() * 365;
  }

  // Profit calculations for NATO
  getDailyProfitNATO(): number {
    return this.getDailyRevenueNATO() - this.getDailyCostsNATO();
  }

  getMonthlyProfitNATO(): number {
    return this.getDailyProfitNATO() * 30;
  }

  getYearlyProfitNATO(): number {
    return this.getDailyProfitNATO() * 365;
  }

  // Per worker calculations for USSR (profit per currently working worker)
  getDailyProfitPerWorkerUSSR(): number {
    return this.currentWorkers > 0 ? this.getDailyProfitUSSR() / this.currentWorkers : 0;
  }

  getMonthlyProfitPerWorkerUSSR(): number {
    return this.currentWorkers > 0 ? this.getMonthlyProfitUSSR() / this.currentWorkers : 0;
  }

  getYearlyProfitPerWorkerUSSR(): number {
    return this.currentWorkers > 0 ? this.getYearlyProfitUSSR() / this.currentWorkers : 0;
  }

  // Per worker calculations for NATO (profit per currently working worker)
  getDailyProfitPerWorkerNATO(): number {
    return this.currentWorkers > 0 ? this.getDailyProfitNATO() / this.currentWorkers : 0;
  }

  getMonthlyProfitPerWorkerNATO(): number {
    return this.currentWorkers > 0 ? this.getMonthlyProfitNATO() / this.currentWorkers : 0;
  }

  getYearlyProfitPerWorkerNATO(): number {
    return this.currentWorkers > 0 ? this.getYearlyProfitNATO() / this.currentWorkers : 0;
  }
}
