import { Injectable } from '@angular/core';
import { IndustryService } from './industry';
import { PricesService } from './prices';
import { IndustryBuilding } from './models/industry.model';
import { ResourcePrice } from './models/prices.model';
import {
  ResourceTree,
  ProductionChain,
  ChainBuilding,
  ChainBuildingInput,
  ChainBuildingOutput,
  ResourceNode,
  ResourceProducer,
  ResourceConsumer,
  BuildingChain
} from './models/resource-tree.model';

@Injectable({
  providedIn: 'root'
})
export class ResourceTreeService {
  constructor(
    private industryService: IndustryService,
    private pricesService: PricesService
  ) {}

  generateResourceTree(): ResourceTree {
    const buildings = this.industryService.getAllBuildings();
    const chains = this.buildProductionChains(buildings);
    const isolatedBuildings = this.findIsolatedBuildings(buildings, chains);

    return {
      chains,
      isolatedBuildings,
      totalChains: chains.length
    };
  }

  private buildProductionChains(buildings: IndustryBuilding[]): ProductionChain[] {
    const chains: ProductionChain[] = [];
    const processedBuildings = new Set<string>();

    // Find final product buildings (those whose outputs are not consumed by other buildings)
    const finalProductBuildings = this.findFinalProductBuildings(buildings);

    finalProductBuildings.forEach(building => {
      if (processedBuildings.has(building.name)) return;

      const chain = this.traceSupplyChain(building, buildings, processedBuildings);
      if (chain.buildings.length > 0) {
        chains.push(chain);
      }
    });

    return chains;
  }

  private findFinalProductBuildings(buildings: IndustryBuilding[]): IndustryBuilding[] {
    return buildings.filter(building => {
      return building.production.outputs.every(output => {
        // Check if this output is consumed by any other building
        const isConsumed = buildings.some(otherBuilding =>
          otherBuilding.name !== building.name &&
          otherBuilding.consumption.inputs.some(input =>
            input.name.toLowerCase() === output.name.toLowerCase()
          )
        );
        return !isConsumed;
      });
    });
  }

  private traceSupplyChain(finalBuilding: IndustryBuilding, allBuildings: IndustryBuilding[], processedBuildings: Set<string>): ProductionChain {
    const chainBuildings: ChainBuilding[] = [];
    const buildingQueue: { building: IndustryBuilding, level: number }[] = [{ building: finalBuilding, level: 0 }];
    const chainProcessed = new Set<string>();

    while (buildingQueue.length > 0) {
      const { building, level } = buildingQueue.shift()!;

      if (chainProcessed.has(building.name)) continue;
      chainProcessed.add(building.name);
      processedBuildings.add(building.name);

      const chainBuilding = this.createChainBuilding(building, level, allBuildings);
      chainBuildings.push(chainBuilding);

      // Find supplier buildings
      building.consumption.inputs.forEach(input => {
        const supplierBuilding = allBuildings.find(b =>
          b.production.outputs.some(output =>
            output.name.toLowerCase() === input.name.toLowerCase()
          )
        );

        if (supplierBuilding && !chainProcessed.has(supplierBuilding.name)) {
          buildingQueue.push({ building: supplierBuilding, level: level + 1 });
        }
      });
    }

    // Calculate ratios
    this.calculateChainRatios(chainBuildings);

    // Position buildings for visualization
    this.positionBuildings(chainBuildings);

    const finalProducts = finalBuilding.production.outputs.map(o => o.name);
    const rootInputs = this.findRootInputs(chainBuildings);

    return {
      id: this.generateChainId(finalProducts),
      name: this.generateChainName(finalProducts),
      buildings: chainBuildings,
      finalProducts,
      rootInputs
    };
  }

  private createChainBuilding(building: IndustryBuilding, level: number, allBuildings: IndustryBuilding[]): ChainBuilding {
    const inputs: ChainBuildingInput[] = building.consumption.inputs.map(input => {
      const supplierBuilding = allBuildings.find(b =>
        b.production.outputs.some(output =>
          output.name.toLowerCase() === input.name.toLowerCase()
        )
      );

      return {
        resourceName: input.name,
        quantity: input.quantity,
        sourceType: supplierBuilding ? 'building' : 'market',
        sourceBuilding: supplierBuilding?.name
      };
    });

    const outputs: ChainBuildingOutput[] = building.production.outputs.map(output => {
      const consumers = allBuildings
        .filter(b => b.consumption.inputs.some(input =>
          input.name.toLowerCase() === output.name.toLowerCase()
        ))
        .map(b => b.name);

      return {
        resourceName: output.name,
        quantity: output.quantity,
        consumers
      };
    });

    return {
      name: building.name,
      ratio: 1.0, // Will be calculated later
      level,
      inputs,
      outputs,
      position: { x: 0, y: 0 } // Will be calculated later
    };
  }

  private getAllResourceNames(buildings: IndustryBuilding[]): string[] {
    const resourceNames = new Set<string>();

    buildings.forEach(building => {
      building.consumption.inputs.forEach(input => {
        resourceNames.add(input.name);
      });
      building.production.outputs.forEach(output => {
        resourceNames.add(output.name);
      });
    });

    return Array.from(resourceNames);
  }

  private findProducers(resourceName: string, buildings: IndustryBuilding[]): ResourceProducer[] {
    return buildings
      .filter(building =>
        building.production.outputs.some(output =>
          output.name.toLowerCase() === resourceName.toLowerCase()
        )
      )
      .map(building => {
        const output = building.production.outputs.find(o =>
          o.name.toLowerCase() === resourceName.toLowerCase()
        )!;

        return {
          buildingName: building.name,
          outputQuantity: output.quantity,
          maxPerDay: building.production.maxPerDay,
          requiredBuildings: 1,
          inputRequirements: building.consumption.inputs.map(input => ({
            resourceName: input.name,
            quantity: input.quantity,
            source: 'market' as const,
            requiresBuildings: 1
          }))
        };
      });
  }

  private findConsumers(resourceName: string, buildings: IndustryBuilding[]): ResourceConsumer[] {
    return buildings
      .filter(building =>
        building.consumption.inputs.some(input =>
          input.name.toLowerCase() === resourceName.toLowerCase()
        )
      )
      .map(building => {
        const input = building.consumption.inputs.find(i =>
          i.name.toLowerCase() === resourceName.toLowerCase()
        )!;

        return {
          buildingName: building.name,
          inputQuantity: input.quantity,
          maxPerDay: building.production.maxPerDay,
          requiredBuildings: 1,
          outputs: building.production.outputs.map(output => ({
            resourceName: output.name,
            quantity: output.quantity
          }))
        };
      });
  }

  private calculateChainRatios(chainBuildings: ChainBuilding[]): void {
    // Sort by level (0 = final product, higher = earlier in chain)
    const sortedBuildings = [...chainBuildings].sort((a, b) => a.level - b.level);

    // Start with final products (level 0) having ratio 1.0
    sortedBuildings.forEach(building => {
      if (building.level === 0) {
        building.ratio = 1.0;
      }
    });

    // Work backwards through levels
    for (let level = 1; level <= Math.max(...sortedBuildings.map(b => b.level)); level++) {
      const currentLevelBuildings = sortedBuildings.filter(b => b.level === level);

      currentLevelBuildings.forEach(building => {
        let maxRatio = 0;

        // Find all buildings that consume this building's outputs
        building.outputs.forEach(output => {
          output.consumers.forEach(consumerName => {
            const consumerBuilding = sortedBuildings.find(b => b.name === consumerName);
            if (!consumerBuilding) return;

            // Find how much of this resource the consumer needs
            const consumerInput = consumerBuilding.inputs.find(i =>
              i.resourceName.toLowerCase() === output.resourceName.toLowerCase()
            );

            if (consumerInput) {
              // Calculate required ratio based on consumer's needs
              const requiredRatio = (consumerInput.quantity * consumerBuilding.ratio) / output.quantity;
              maxRatio = Math.max(maxRatio, requiredRatio);
            }
          });
        });

        building.ratio = Math.round(Math.max(maxRatio, 1.0) * 100) / 100;
      });
    }
  }

  private findRootResources(nodes: { [resourceName: string]: ResourceNode }): string[] {
    return Object.keys(nodes).filter(resourceName => {
      const node = nodes[resourceName];
      return node.consumers && node.consumers.length > 0 &&
             (!node.producers || node.producers.length === 0);
    });
  }

  private getBestPrice(resourcePrice: ResourcePrice): number {
    // Use the best buying price (lowest cost)
    const prices = [
      resourcePrice.prices.natoBuy,
      resourcePrice.prices.ussrBuy
    ].filter(price => price > 0);

    return prices.length > 0 ? Math.min(...prices) : 0;
  }

  private calculateTotalMarketCost(nodes: { [resourceName: string]: ResourceNode }): number {
    return Object.values(nodes)
      .filter(node => node.source === 'market')
      .reduce((total, node) => total + (node.totalValue || 0), 0);
  }

  private calculateTotalIndustrialValue(nodes: { [resourceName: string]: ResourceNode }): number {
    return Object.values(nodes)
      .filter(node => node.source === 'industry')
      .reduce((total, node) => total + (node.totalValue || 0), 0);
  }

  private positionBuildings(chainBuildings: ChainBuilding[]): void {
    const levels = new Map<number, ChainBuilding[]>();

    // Group buildings by level
    chainBuildings.forEach(building => {
      if (!levels.has(building.level)) {
        levels.set(building.level, []);
      }
      levels.get(building.level)!.push(building);
    });

    // Position buildings within each level
    let yOffset = 0;
    const levelSpacing = 200;
    const buildingSpacing = 150;

    levels.forEach((buildings, level) => {
      const xOffset = -(buildings.length - 1) * buildingSpacing / 2;

      buildings.forEach((building, index) => {
        building.position = {
          x: xOffset + index * buildingSpacing,
          y: yOffset
        };
      });

      yOffset += levelSpacing;
    });
  }

  private findRootInputs(chainBuildings: ChainBuilding[]): string[] {
    const rootInputs: string[] = [];

    chainBuildings.forEach(building => {
      building.inputs.forEach(input => {
        if (input.sourceType === 'market' && !rootInputs.includes(input.resourceName)) {
          rootInputs.push(input.resourceName);
        }
      });
    });

    return rootInputs;
  }

  private generateChainId(finalProducts: string[]): string {
    return finalProducts.join('-').toLowerCase().replace(/\s+/g, '-');
  }

  private generateChainName(finalProducts: string[]): string {
    if (finalProducts.length === 1) {
      return `${finalProducts[0]} Production Chain`;
    }
    return `${finalProducts.join(', ')} Production Chain`;
  }

  private findIsolatedBuildings(allBuildings: IndustryBuilding[], chains: ProductionChain[]): ChainBuilding[] {
    const processedBuildings = new Set<string>();
    chains.forEach(chain => {
      chain.buildings.forEach(building => {
        processedBuildings.add(building.name);
      });
    });

    return allBuildings
      .filter(building => !processedBuildings.has(building.name))
      .map(building => this.createChainBuilding(building, 0, allBuildings));
  }
}