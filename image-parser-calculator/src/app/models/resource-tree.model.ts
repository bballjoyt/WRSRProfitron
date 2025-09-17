export interface ResourceNode {
  resourceName: string;
  quantity: number;
  source: 'market' | 'industry';
  pricePerUnit?: number;
  totalValue?: number;
  producers?: ResourceProducer[];
  consumers?: ResourceConsumer[];
  marketData?: {
    natoSell: number;
    natoBuy: number;
    ussrSell: number;
    ussrBuy: number;
  };
}

export interface ResourceProducer {
  buildingName: string;
  outputQuantity: number;
  maxPerDay: number;
  requiredBuildings: number;
  inputRequirements: ResourceRequirement[];
}

export interface ResourceConsumer {
  buildingName: string;
  inputQuantity: number;
  maxPerDay: number;
  requiredBuildings: number;
  outputs: ResourceOutput[];
}

export interface ResourceRequirement {
  resourceName: string;
  quantity: number;
  source: 'market' | 'industry';
  requiresBuildings: number;
}

export interface ResourceOutput {
  resourceName: string;
  quantity: number;
}

export interface ProductionChain {
  id: string;
  name: string;
  buildings: ChainBuilding[];
  finalProducts: string[];
  rootInputs: string[];
}

export interface ChainBuilding {
  name: string;
  ratio: number;
  level: number; // Tree depth level (0 = final product, higher = earlier in chain)
  inputs: ChainBuildingInput[];
  outputs: ChainBuildingOutput[];
  position: TreePosition;
}

export interface ChainBuildingInput {
  resourceName: string;
  quantity: number;
  sourceType: 'market' | 'building';
  sourceBuilding?: string;
}

export interface ChainBuildingOutput {
  resourceName: string;
  quantity: number;
  consumers: string[]; // Buildings that consume this output
}

export interface TreePosition {
  x: number;
  y: number;
}

export interface ResourceTree {
  chains: ProductionChain[];
  isolatedBuildings: ChainBuilding[];
  totalChains: number;
}

export interface BuildingChain {
  building: string;
  ratio: number;
  inputs: ChainInput[];
  outputs: ChainOutput[];
}

export interface ChainInput {
  resource: string;
  quantity: number;
  source: 'market' | 'building';
  sourceBuilding?: string;
  sourceBuildingRatio?: number;
}

export interface ChainOutput {
  resource: string;
  quantity: number;
}