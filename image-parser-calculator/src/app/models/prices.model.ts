export interface PriceData {
  natoSell: number;
  natoBuy: number;
  ussrSell: number;
  ussrBuy: number;
}

export interface ResourcePrice {
  name: string;
  prices: PriceData;
  lastUpdated: string;
}

export interface PricesDataset {
  id: string;
  filename: string;
  extractedText: string;
  originalText?: string; // Keep the original OCR text
  timestamp: string;
  resources: ResourcePrice[];
  totalResources: number;
}

export interface PricesStore {
  datasets: PricesDataset[];
  resourceIndex: { [resourceName: string]: ResourcePrice };
}