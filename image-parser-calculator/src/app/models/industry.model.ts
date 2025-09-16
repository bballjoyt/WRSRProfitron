export type ImportSource = 'own' | 'importNATO' | 'importUSSR';
export type ExportTarget = 'own' | 'exportNATO' | 'exportUSSR';

export interface ResourceRequirement {
  name: string;
  quantity: number;
  importSource: ImportSource;
}

export interface ResourceProduction {
  name: string;
  quantity: number;
  value?: number; // Will be calculated based on prices
  exportTarget: ExportTarget;
}

export interface IndustryBuilding {
  name: string;
  maxWorkers?: number; // Maximum number of workers for the building
  constructionCost: {
    materials: ResourceRequirement[];
    totalCost: number; // Will be calculated
  };
  production: {
    maxPerDay: number;
    maxPerBuilding: number;
    outputs: ResourceProduction[];
  };
  consumption: {
    inputs: ResourceRequirement[];
  };
  pollution: {
    level: number; // Pollution level generated
    type?: string; // Type of pollution if specified
  };
  profitability: {
    dailyCost: number;
    dailyRevenue: number;
    dailyProfit: number;
    yearlyProfit: number;
    monthlyProfit: number;
    profitPerWorkerDay: number;
  };
  originalParsedValues?: IndustryBuilding; // Store original parsed values for reset functionality
}

export interface IndustryDataset {
  id: string;
  filename: string;
  extractedText: string;
  timestamp: string;
  userDefinedName: string; // User-provided name as primary key
  buildings: IndustryBuilding[];
  totalBuildings: number;
}

export interface IndustryStore {
  datasets: IndustryDataset[];
  buildingIndex: { [buildingName: string]: IndustryBuilding };
  nameIndex: { [userDefinedName: string]: IndustryDataset }; // Index by user-defined names
}