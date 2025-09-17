import { Injectable } from '@angular/core';
import { recognize } from 'tesseract.js';
import { PricesDataset, ResourcePrice } from './models/prices.model';
import { IndustryDataset, IndustryBuilding, ResourceRequirement, ResourceProduction, ImportSource, ExportTarget } from './models/industry.model';

@Injectable({
  providedIn: 'root'
})
export class OcrService {

  // Resource name mapping for OCR variations to standardized names
  private resourceNameMap: { [key: string]: string } = {
    'mechanical comp.': 'mechanical components',
    'Mechanical comp.': 'mechanical components',
    'mechanical comp': 'mechanical components',
    'Mechanical comp': 'mechanical components',
    'Mechanical Comp': 'mechanical components',
    'mechanic comp.': 'mechanical components',
    'Mechanic comp.': 'mechanical components',
    'mechanical components': 'mechanical components',
    'Mechanical Components': 'mechanical components',
    'nuclear fuel': 'nuclear fuel',
    'Nuclear fuel': 'nuclear fuel',
    'Nuclear Fuel': 'nuclear fuel',
    'steel': 'steel',
    'Steel': 'steel',
    'concrete': 'concrete',
    'Concrete': 'concrete',
    'gravel': 'gravel',
    'Gravel': 'gravel',
    'asphalt': 'asphalt',
    'Asphalt': 'asphalt',
    'bricks': 'bricks',
    'Bricks': 'bricks',
    'boards': 'boards',
    'Boards': 'boards',
    'workdays': 'workdays',
    'Workdays': 'workdays'
  };

  private normalizeResourceName(name: string): string {
    // First try exact match
    if (this.resourceNameMap[name]) {
      return this.resourceNameMap[name];
    }

    // Try case-insensitive match
    const lowerName = name.toLowerCase();
    for (const [key, value] of Object.entries(this.resourceNameMap)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }

    // Return original name if no mapping found
    return name;
  }

  async extractText(file: File): Promise<string> {
    try {
      const result = await recognize(file, 'eng', {
        logger: m => console.log('OCR Progress:', m)
      });

      return result.data.text;
    } catch (error) {
      console.error('OCR Error:', error);
      throw error;
    }
  }

  async extractStructuredData(file: File): Promise<any> {
    try {
      const text = await this.extractText(file);
      const structuredData = this.parseTextToJSON(text);
      return structuredData;
    } catch (error) {
      console.error('Structured data extraction error:', error);
      throw error;
    }
  }

  private parseTextToJSON(text: string): any {
    const lines = text.split('\n').filter(line => line.trim());
    const data: any = {
      rawText: text,
      lines: lines,
      numbers: this.extractNumbers(text),
      dates: this.extractDates(text),
      emails: this.extractEmails(text)
    };

    return data;
  }

  private extractNumbers(text: string): number[] {
    const normalizedText = text.replace(/(\d+),(\d{3})/g, '$1$2');
    const numberRegex = /\d+\.?\d*/g;
    const matches = normalizedText.match(numberRegex);
    return matches ? matches.map(n => parseFloat(n)).filter(n => !isNaN(n)) : [];
  }

  private extractDates(text: string): string[] {
    const dateRegex = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{1,2}-\d{1,2}-\d{2,4}\b/g;
    const matches = text.match(dateRegex);
    return matches ? matches : [];
  }

  private extractEmails(text: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex);
    return matches ? matches : [];
  }

  async extractPricesData(file: File): Promise<PricesDataset | null> {
    try {

      const text = await this.extractText(file);
      const resources = this.parsePricesText(text);

      return {
        id: Date.now().toString(),
        filename: file.name,
        extractedText: text,
        originalText: text,
        timestamp: new Date().toISOString(),
        resources: resources,
        totalResources: resources.length
      };
    } catch (error) {
      console.error('Prices data extraction error:', error);
      throw error;
    }
  }

  private parsePricesText(text: string): ResourcePrice[] {
    const resources: ResourcePrice[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const resource = this.parsePricesResourceLine(line);
      if (resource) {
        resources.push(resource);
      }
    }

    return resources;
  }

  private parsePricesResourceLine(line: string): ResourcePrice | null {
    const cleanLine = line.replace(/^[^a-zA-Z]*/, '').trim();

    if (!cleanLine ||
        cleanLine.toLowerCase().includes('resource') ||
        cleanLine.toLowerCase().includes('sell') ||
        cleanLine.toLowerCase().includes('buy') ||
        cleanLine.toLowerCase().includes('current prices') ||
        cleanLine.toLowerCase().includes('global market') ||
        cleanLine.length < 5) {
      return null;
    }

    const parts = cleanLine.split(':');
    if (parts.length < 2) return null;

    let resourceName = parts[0].trim();
    const pricesText = parts.slice(1).join(':').trim();

    resourceName = this.cleanResourceName(resourceName);

    const normalizedText = pricesText.replace(/(\d+),(\d{3})/g, '$1$2');
    const numberRegex = /-?\d+\.?\d*/g;
    const matches = normalizedText.match(numberRegex);

    if (!matches || matches.length < 4) return null;

    const numbers = matches.map(n => parseFloat(n)).filter(n => !isNaN(n));

    if (numbers.length >= 4) {
      return {
        name: resourceName,
        prices: {
          ussrSell: numbers[0],
          ussrBuy: numbers[1],
          natoSell: numbers[2],
          natoBuy: numbers[3]
        },
        lastUpdated: new Date().toISOString()
      };
    }

    return null;
  }

  private cleanResourceName(name: string): string {
    let cleanName = name;

    // Remove common OCR artifacts and prefixes
    cleanName = cleanName.replace(/^[a-zA-Z]\s+/, ''); // Single letter + space
    cleanName = cleanName.replace(/^[Mm][n]?\s+/, ''); // M or Mn prefix (common OCR artifact)
    cleanName = cleanName.replace(/^[^a-zA-Z]*\|\s*/, ''); // Non-letter chars + pipe
    cleanName = cleanName.replace(/^[^\w\s]*/, ''); // Leading non-word chars
    cleanName = cleanName.replace(/\s+/g, ' '); // Normalize whitespace
    cleanName = cleanName.trim();

    // Apply resource name mapping for known variations
    cleanName = this.normalizeResourceName(cleanName);

    // Capitalize first letter if not already mapped
    if (cleanName.length > 0 && cleanName === cleanName.toLowerCase()) {
      cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
    }

    return cleanName;
  }

  async extractIndustryData(file: File): Promise<IndustryDataset | null> {
    try {
      if (file.name.toLowerCase().startsWith('prices')) {
        return null;
      }

      const text = await this.extractText(file);
      const buildings = this.parseIndustryText(text);

      return {
        id: Date.now().toString(),
        filename: file.name,
        extractedText: text,
        timestamp: new Date().toISOString(),
        userDefinedName: '',
        buildings: buildings,
        totalBuildings: buildings.length
      };
    } catch (error) {
      console.error('Industry data extraction error:', error);
      throw error;
    }
  }

  private parseIndustryText(text: string): IndustryBuilding[] {
    const buildings: IndustryBuilding[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    // Find building name (clean up factory name)
    let buildingName = '';
    for (const line of lines) {
      if (line.toLowerCase().includes('factory')) {
        // Clean up the factory name
        buildingName = line.replace(/[|\\x]/g, '').trim();
        // Remove leading special characters and numbers
        buildingName = buildingName.replace(/^[^a-zA-Z]*/, '').trim();
        break;
      }
    }

    if (!buildingName) {
      console.log('No factory name found');
      return buildings;
    }

    console.log(`Found building: ${buildingName}`);

    // Extract construction materials
    const constructionMaterials = this.extractConstructionMaterials(text);

    // Extract production data
    const production = this.extractProductionData(text);

    // Extract consumption data
    const consumption = this.extractConsumptionData(text);


    // Extract pollution
    const pollution = this.extractPollutionData(text);

    // Extract max workers
    const maxWorkers = this.extractMaxWorkers(text);
    console.log(`Building "${buildingName}" maxWorkers set to: ${maxWorkers}`);

    const building: IndustryBuilding = {
      name: buildingName,
      maxWorkers: maxWorkers, // Add the extracted maxWorkers
      constructionCost: {
        materials: constructionMaterials,
        totalCost: 0 // Will be calculated based on prices
      },
      production: {
        maxPerDay: production.maxPerDay || 0,
        maxPerBuilding: 0,
        outputs: production.outputs || []
      },
      consumption: {
        inputs: consumption.inputs || []
      },
      profitability: {
        dailyCost: 0,
        dailyRevenue: 0,
        dailyProfit: 0,
        yearlyProfit: 0,
        monthlyProfit: 0,
        profitPerWorkerDay: 0
      },
      metadata: {
        pollution: pollution ? {
          level: pollution,
          type: 'air' // Default type
        } : undefined
      }
    };

    // Store original parsed values for reset functionality
    building.originalParsedValues = JSON.parse(JSON.stringify(building));

    buildings.push(building);
    return buildings;
  }


  private extractConstructionMaterials(text: string): ResourceRequirement[] {
    const lines = text.split('\n').filter(line => line.trim());
    const materials: ResourceRequirement[] = [];
    let inBuildingSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Start tracking when we see "Resources needed to build:"
      if (line.toLowerCase().includes('resources needed to build')) {
        inBuildingSection = true;
        continue;
      }

      // Stop when we hit another major section
      if (inBuildingSection && (
          line.toLowerCase().includes('maximum number of workers') ||
          line.toLowerCase().includes('building lifespan') ||
          line.toLowerCase().includes('ure number of workers')
      )) {
        break;
      }

      if (inBuildingSection && line) {
        // Handle workdays pattern first: "2712 Workdays"
        const workdaysMatch = line.match(/(\d+(?:\.\d+)?)\s+workdays/i);
        if (workdaysMatch) {
          const quantity = parseFloat(workdaysMatch[1]);
          if (!materials.find(m => m.name === 'Workdays')) {
            materials.push({
              name: 'Workdays',
              quantity: quantity,
              importSource: 'own' as ImportSource
            });
          }
        }

        // Process the line for construction materials only
        // Handle patterns like: "| 2712 Workdays & 246t of Concrete"
        // and: "62t of Gravel 50t of Asphalt"

        // Remove leading special characters but preserve numbers for workdays
        let cleanLine = line.replace(/^[|p\s]*/, '').trim();

        // Split on & or > and process each part - but skip parts that contain "workdays" since we already handled it
        // Skip this parsing if the line contains multiple "t of" patterns (handled by multi-material regex below)
        if (!line.match(/\d+(?:\.\d+)?t\s+of\s+.+?\s+\d+(?:\.\d+)?t\s+of/)) {
          const parts = cleanLine.split(/[&>]/);
          for (const part of parts) {
            const trimmedPart = part.trim();
            // Skip parts that contain workdays since we already handled them
            if (trimmedPart.toLowerCase().includes('workdays')) continue;

            if (trimmedPart) {
              // Try to extract materials from this part
              this.extractMaterialsFromLine(trimmedPart, materials);
            }
          }
        }

        // Also try to parse multiple materials in same line (space separated)
        // Match patterns like "62t of Gravel 50t of Asphalt" and "31t of Boards 0.062t of Mechanic comp."
        const multiMatches = [...line.matchAll(/(\d+(?:\.\d+)?)\s*t\s+of\s+([a-zA-Z\s\.]+?)(?=\s*(?:\d+(?:\.\d+)?t|\s*$))/gi)];
        if (multiMatches.length > 0) {
          for (const match of multiMatches) {
            const fullMatch = match[0]; // Full matched string like "31t of Boards"
            const material = this.parseMaterialLine(fullMatch);
            if (material && material.name !== 'Workdays' && !materials.find(m => m.name === material.name)) {
              materials.push(material);
            }
          }
        }
      }
    }

    return materials;
  }

  private extractMaterialsFromLine(line: string, materials: ResourceRequirement[]): void {
    // Handle workdays pattern first: "2712 Workdays"
    const workdaysMatch = line.match(/(\d+(?:\.\d+)?)\s+workdays/i);
    if (workdaysMatch) {
      const quantity = parseFloat(workdaysMatch[1]);
      if (!materials.find(m => m.name === 'Workdays')) {
        materials.push({
          name: 'Workdays',
          quantity: quantity,
          importSource: 'own' as ImportSource
        });
      }
    }

    // Handle multiple materials in one line like "62t of Gravel 50t of Asphalt"
    // First try to match all "Xt of Material" patterns
    const materialMatches = line.match(/(\d+(?:\.\d+)?)\s*t\s+of\s+([^0-9]+?)(?=\s+\d+|$)/gi);
    if (materialMatches) {
      for (const match of materialMatches) {
        const material = this.parseMaterialLine(match.trim());
        if (material && !materials.find(m => m.name === material.name)) {
          materials.push(material);
        }
      }
      return;
    }

    // Then try single material patterns (but not if we already handled workdays)
    if (!workdaysMatch) {
      const singleMaterial = this.parseMaterialLine(line);
      if (singleMaterial && !materials.find(m => m.name === singleMaterial.name)) {
        materials.push(singleMaterial);
      }
    }
  }

  private extractProductionData(text: string): {outputs: ResourceProduction[], maxPerDay: number} {
    const lines = text.split('\n').filter(line => line.trim());
    const outputs: ResourceProduction[] = [];
    let maxPerDay = 0;
    let inProductionSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Look for production section headers
      if (line.toLowerCase().includes('maximum production per workday')) {
        inProductionSection = true;
        continue;
      }

      // Stop when we hit consumption or other sections
      if (inProductionSection && (
          line.toLowerCase().includes('consumption at maximum production') ||
          line.toLowerCase().includes('max. daily garbage')
      )) {
        break;
      }

      if (inProductionSection && line) {
        // Look for patterns like "§ 1.1t of Explosives", "4 K 5.0t of Fabric", "BI 1.2t of Clothes"
        const productionMatch = line.match(/[§4K@BI]*\s*(\d+(?:\.\d+)?)(?:\.(\d+))?\s*t?\s*of\s+(\w+)/i);
        if (productionMatch) {
          let quantity = parseFloat(productionMatch[1]);

          // Handle cases where decimal is separated by space or 't' like "12t of" vs "1.2t of"
          if (productionMatch[2]) {
            quantity = parseFloat(productionMatch[1] + '.' + productionMatch[2]);
          }

          // Special handling for likely decimal cases - if number > 10 and no decimal, might be missing decimal
          if (quantity >= 10 && !productionMatch[1].includes('.')) {
            // Check if this looks like it should be a decimal (common for clothing: 12 -> 1.2)
            const productName = productionMatch[3] || productionMatch[2];
            if (productName && productName.toLowerCase().includes('cloth')) {
              quantity = quantity / 10; // 12 -> 1.2
            }
          }

          const productName = productionMatch[3] || productionMatch[2];

          outputs.push({
            name: productName,
            quantity: quantity,
            exportTarget: 'exportUSSR' as ExportTarget
          });

          maxPerDay = Math.max(maxPerDay, quantity);
        }
      }
    }

    return { outputs, maxPerDay };
  }

  private extractConsumptionData(text: string): {inputs: ResourceRequirement[]} {
    const lines = text.split('\n').filter(line => line.trim());
    const inputs: ResourceRequirement[] = [];
    let inConsumptionSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Look for consumption section headers
      if (line.toLowerCase().includes('consumption at maximum production')) {
        inConsumptionSection = true;
        continue;
      }

      // Stop when we hit other sections
      if (inConsumptionSection && (
          line.toLowerCase().includes('required water quality') ||
          line.toLowerCase().includes('max. daily garbage') ||
          line.toLowerCase().includes('garbage production')
      )) {
        break;
      }

      if (inConsumptionSection && line &&
          !line.toLowerCase().includes('required water quality')) {

        // Parse multiple materials from one line like "AE 0.75t of Chemicals 5] 2.3t of Gravel"
        // or "20t of Crops y 0.50t of Chemicals"
        // or "$ 37t of Crops é 7.5m? of Water"
        // Enhanced to catch water with m³ units: "11m? of Water", "7.5m? of Water"
        const consumptionMatches = [...line.matchAll(/(\d+(?:\.\d+)?)\s*[tm][³\?\w]*\s*(?:of\s+)?(\w+)/gi)];
        if (consumptionMatches.length > 0) {
          for (const match of consumptionMatches) {
            const quantity = parseFloat(match[1]);
            const inputName = match[2];

            // Skip power entries
            if (inputName.toLowerCase() === 'power') continue;

            // Avoid duplicates
            if (!inputs.find(inp => inp.name === inputName)) {
              inputs.push({
                name: inputName,
                quantity: quantity,
                importSource: 'importUSSR' as ImportSource
              });
            }
          }
        }
      }
    }

    return { inputs };
  }


  private extractMaxWorkers(text: string): number {
    const lines = text.split('\n').filter(line => line.trim());

    console.log('=== EXTRACTING MAX WORKERS ===');

    // First, look for the exact pattern like "Ure number of workers: 1 ° I 75"
    const fullTextPattern = /ure number of workers:?\s*\d+\s*[°º]*\s*I\s*(\d+)/i;
    const fullTextMatch = text.match(fullTextPattern);
    if (fullTextMatch) {
      const workers = parseInt(fullTextMatch[1]);
      console.log(`✅ Found maxWorkers using full text pattern: ${workers}`);
      return workers;
    }

    // Look for similar patterns across multiple lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Look for various patterns indicating maximum workers (including corrupted OCR text)
      const workerPatterns = [
        'maximum number of workers',
        'max workers',
        'maximum workers',
        'ure number of workers',  // Handle OCR corruption like "Ure number of workers"
        'number of workers'       // More general pattern
      ];

      const lineToCheck = line.toLowerCase();
      let foundWorkerLine = false;

      for (const pattern of workerPatterns) {
        if (lineToCheck.includes(pattern)) {
          foundWorkerLine = true;
          console.log(`🔍 Found worker pattern: "${pattern}" in line: "${line}"`);
          break;
        }
      }

      if (foundWorkerLine) {
        // Handle special case like "Ure number of workers: 1 ° I 75" where 75 is the actual value
        // Look for pattern: number followed by ° I and another number
        const specialMatch = line.match(/(\d+)\s*[°º]*\s*I\s*(\d+)/);
        if (specialMatch) {
          const workers = parseInt(specialMatch[2]); // Take the second number
          console.log(`✅ Extracted maxWorkers using special pattern (°I): ${workers}`);
          return workers;
        }

        // Look for number in next line - handle patterns like "i 100", "O 80", "o 150"
        // Also check multiple lines ahead since the number might be separated by "°" character
        for (let j = 1; j <= 3; j++) {
          if (i + j < lines.length) {
            const nextLine = lines[i + j].trim();
            console.log(`🔍 Checking line +${j} for numbers: "${nextLine}"`);

            // Check for special characters followed by numbers (like "i 100", "O 80", "o 150")
            const nextSpecialMatch = nextLine.match(/[°ºIOio]\s*(\d+)/);
            if (nextSpecialMatch) {
              const workers = parseInt(nextSpecialMatch[1]);
              console.log(`✅ Extracted maxWorkers from line +${j} using special pattern: ${workers}`);
              return workers;
            }

            // Check for just numbers in the line
            const nextWorkerMatch = nextLine.match(/^\s*(\d+)\s*$/);
            if (nextWorkerMatch) {
              const workers = parseInt(nextWorkerMatch[1]);
              // Ensure it's a reasonable worker count (not some other random number)
              if (workers >= 10 && workers <= 1000) {
                console.log(`✅ Extracted maxWorkers from line +${j}: ${workers}`);
                return workers;
              }
            }
          }
        }
      }
    }

    console.log('❌ No maxWorkers found, defaulting to 1');
    return 1; // Default to 1 instead of 0 to avoid division by zero
  }

  private extractPollutionData(text: string): number {
    const lines = text.split('\n').filter(line => line.trim());

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.toLowerCase().includes('environment pollution')) {
        // Check the next line for pollution data
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          // Look for patterns like "ad 10.00 tons/year" or "a 8.20 tons/year"
          const pollutionMatch = nextLine.match(/[ad]*\s*(\d+(?:\.\d+)?)\s*tons?[\s\/]*year/i);
          if (pollutionMatch) {
            return parseFloat(pollutionMatch[1]);
          }
        }
      }
    }

    return 0;
  }

  private parseMaterialLine(line: string): ResourceRequirement | null {
    // First try to match "X t of Material" pattern
    let match = line.match(/(\d+(?:\.\d+)?)\s*t\s*of\s+(.+)/i);
    if (match) {
      const quantity = parseFloat(match[1]);
      let materialName = match[2].trim();

      // Clean up material name
      materialName = this.cleanMaterialName(materialName);

      if (materialName && quantity > 0) {
        return {
          name: materialName,
          quantity: quantity,
          importSource: 'importUSSR' as ImportSource
        };
      }
    }

    // Try to match "X Workdays" pattern
    match = line.match(/(\d+(?:\.\d+)?)\s+workdays/i);
    if (match) {
      const quantity = parseFloat(match[1]);
      return {
        name: 'Workdays',
        quantity: quantity,
        importSource: 'own' as ImportSource
      };
    }

    // Try to match "Xt Material" pattern (without "of")
    match = line.match(/(\d+(?:\.\d+)?)\s*t\s+(.+)/i);
    if (match) {
      const quantity = parseFloat(match[1]);
      let materialName = match[2].trim();

      // Clean up material name
      materialName = this.cleanMaterialName(materialName);

      if (materialName && quantity > 0 && !materialName.includes('garbage') && !materialName.includes('waste')) {
        return {
          name: materialName,
          quantity: quantity,
          importSource: 'importUSSR' as ImportSource
        };
      }
    }

    return null;
  }

  private cleanMaterialName(name: string): string {
    // Clean up the raw name first
    let cleanName = name
      .replace(/[^\w\s\.]/g, ' ') // Remove special characters except word chars, spaces, and dots
      .replace(/\s+/g, ' ')        // Normalize whitespace
      .trim();

    // Use the resource name mapping
    return this.normalizeResourceName(cleanName);
  }

  private finalizeBuildingData(building: Partial<IndustryBuilding>): IndustryBuilding {
    if (building.constructionCost?.materials) {
      building.constructionCost.totalCost = building.constructionCost.materials
        .reduce((sum, material) => sum + (material.quantity || 0), 0);
    }

    return building as IndustryBuilding;
  }
}