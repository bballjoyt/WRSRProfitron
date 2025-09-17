import pkg from 'tesseract.js';
const { recognize } = pkg;

async function testIndustryExtraction(imagePath) {
  try {
    console.log(`\nTesting Industry Extraction on: ${imagePath}`);
    console.log('='.repeat(60));

    const result = await recognize(imagePath, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    const extractedText = result.data.text;
    console.log('\nExtracted Text:');
    console.log('-'.repeat(40));
    console.log(extractedText);
    console.log('-'.repeat(40));

    // Parse the industry data
    const industryData = parseIndustryText(extractedText, imagePath);

    console.log('\nParsed Industry Data:');
    console.log('='.repeat(40));
    if (industryData) {
      console.log(`Building: ${industryData.name}`);
      console.log(`Construction Materials: ${industryData.constructionCost.materials.length} items`);
      console.log(`Production: ${industryData.production.outputs.length} outputs`);
      console.log(`Consumption: ${industryData.consumption.inputs.length} inputs`);
      console.log(`Pollution: ${industryData.pollution.level}`);
      console.log('');

      // Show details
      console.log('Construction Materials:');
      industryData.constructionCost.materials.forEach(mat => {
        console.log(`  - ${mat.name}: ${mat.quantity}`);
      });

      console.log('Production:');
      industryData.production.outputs.forEach(out => {
        console.log(`  - ${out.name}: ${out.quantity}`);
      });

      console.log('Consumption:');
      industryData.consumption.inputs.forEach(inp => {
        console.log(`  - ${inp.name}: ${inp.quantity}`);
      });
    } else {
      console.log('No industry data parsed');
    }

    return {
      filename: imagePath,
      extractedText,
      industryData,
      success: !!industryData
    };

  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

function parseIndustryText(text) {
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
    return null;
  }

  console.log(`Found building: ${buildingName}`);

  // Extract construction materials with better parsing
  const constructionMaterials = extractConstructionMaterials(text);

  // Extract production data with better parsing
  const production = extractProductionData(text);

  // Extract consumption data with better parsing
  const consumption = extractConsumptionData(text);

  // Extract pollution with better parsing
  const pollution = extractPollutionData(text);

  // Extract max workers with better parsing
  const maxWorkers = extractMaxWorkers(text);
  console.log(`Building "${buildingName}" maxWorkers set to: ${maxWorkers}`);

  return {
    name: buildingName,
    maxWorkers: maxWorkers,
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
    pollution: {
      level: pollution || 0,
      type: 'air' // Default type
    },
    profitability: {
      dailyCost: 0,
      dailyRevenue: 0,
      dailyProfit: 0,
      yearlyProfit: 0,
      monthlyProfit: 0,
      profitPerWorkerDay: 0
    }
  };
}

function parseMaterialLine(line) {
  // Handle patterns like:
  // "2712 Workdays"
  // "246t of Concrete"
  // "37t of Mechanic comp."
  // "0.062t of Mechanic comp."

  const patterns = [
    // Pattern: number + unit + "of" + material name
    /(\d+(?:\.\d+)?)\s*([a-zA-Z]*)\s*(?:of\s+)?(.+)/,
    // Pattern: just number + material name
    /(\d+(?:\.\d+)?)\s+(.+)/
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const quantity = parseFloat(match[1]);
      let unit = match[2] || '';
      let materialName = match[3] || match[2] || '';

      // Clean up material name
      materialName = materialName.replace(/^of\s+/, '').trim();

      // Handle special cases
      if (materialName.toLowerCase().includes('workdays')) {
        materialName = 'Workdays';
      } else if (materialName.toLowerCase().includes('concrete')) {
        materialName = 'Concrete';
        unit = 't';
      } else if (materialName.toLowerCase().includes('gravel')) {
        materialName = 'Gravel';
        unit = 't';
      } else if (materialName.toLowerCase().includes('steel')) {
        materialName = 'Steel';
        unit = 't';
      } else if (materialName.toLowerCase().includes('bricks')) {
        materialName = 'Bricks';
        unit = 't';
      } else if (materialName.toLowerCase().includes('mechanic')) {
        materialName = 'Mechanic components';
        unit = 't';
      } else if (materialName.toLowerCase().includes('boards')) {
        materialName = 'Boards';
        unit = 't';
      } else if (materialName.toLowerCase().includes('asphalt')) {
        materialName = 'Asphalt';
        unit = 't';
      }

      if (materialName && quantity > 0) {
        return {
          name: materialName,
          quantity: quantity,
          importSource: 'own' // Default import source
        };
      }
    }
  }

  return null;
}

function parseProductionData(lines) {
  const outputs = [];
  let maxPerDay = 0;

  for (const line of lines) {
    const cleanLine = line.trim();

    // Look for production patterns like "1.1t of Explosives", "5.0t of Fabric"
    const productionMatch = cleanLine.match(/(\d+(?:\.\d+)?)\s*t?\s*of\s+(\w+)/i);
    if (productionMatch && cleanLine.toLowerCase().includes('production')) {
      const quantity = parseFloat(productionMatch[1]);
      const productName = productionMatch[2];

      outputs.push({
        name: productName,
        quantity: quantity
      });

      maxPerDay = quantity;
    }
  }

  return { outputs, maxPerDay };
}

function parseConsumptionData(lines) {
  const inputs = [];

  for (const line of lines) {
    const cleanLine = line.trim();

    // Look for consumption patterns
    if (cleanLine.toLowerCase().includes('consumption') &&
        !cleanLine.toLowerCase().includes('power') &&
        !cleanLine.toLowerCase().includes('water')) {

      // Parse lines like "0.75t of Chemicals", "2.3t of Gravel"
      const consumptionMatch = cleanLine.match(/(\d+(?:\.\d+)?)\s*t?\s*of\s+(\w+)/i);
      if (consumptionMatch) {
        const quantity = parseFloat(consumptionMatch[1]);
        const inputName = consumptionMatch[2];

        inputs.push({
          name: inputName,
          quantity: quantity,
          importSource: 'own' // Default import source
        });
      }
    }
  }

  return { inputs };
}

function parsePollutionData(lines) {
  for (const line of lines) {
    const cleanLine = line.trim();

    if (cleanLine.toLowerCase().includes('pollution')) {
      const pollutionMatch = cleanLine.match(/(\d+(?:\.\d+)?)\s*tons?\/year/i);
      if (pollutionMatch) {
        return parseFloat(pollutionMatch[1]);
      }
    }
  }

  return 0;
}

function parseMaxWorkers(lines) {
  for (const line of lines) {
    const cleanLine = line.trim();

    if (cleanLine.toLowerCase().includes('maximum number of workers')) {
      const workerMatch = cleanLine.match(/(\d+)/);
      if (workerMatch) {
        return parseInt(workerMatch[1]);
      }
    }

    // Also check next line after "Maximum number of workers:"
    if (cleanLine.toLowerCase().includes('maximum number of workers')) {
      const nextLineIndex = lines.indexOf(line) + 1;
      if (nextLineIndex < lines.length) {
        const nextLine = lines[nextLineIndex].trim();
        const workerMatch = nextLine.match(/(\d+)/);
        if (workerMatch) {
          return parseInt(workerMatch[1]);
        }
      }
    }
  }

  return 0;
}

// Test all industry files
async function testAllIndustryFiles() {
  console.log('🏭 Testing Industry Files Extraction');
  console.log('====================================');

  const industryFiles = [
    './SampleImages/Industry1.png',
    './SampleImages/Industry2.png',
    './SampleImages/Industry3.png',
    './SampleImages/Industry4.png'
  ];

  const results = [];

  for (const file of industryFiles) {
    try {
      const result = await testIndustryExtraction(file);
      results.push(result);

      // Brief pause between files
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to process ${file}:`, error);
    }
  }

  console.log('\n📊 SUMMARY');
  console.log('===========');
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.filename}: ${result.success ? '✅ Success' : '❌ Failed'}`);
    if (result.success && result.industryData) {
      console.log(`   Building: ${result.industryData.name}`);
      console.log(`   MaxWorkers: ${result.industryData.maxWorkers}, Materials: ${result.industryData.constructionCost.materials.length}, Outputs: ${result.industryData.production.outputs.length}, Inputs: ${result.industryData.consumption.inputs.length}`);
    }
  });

  return results;
}

function extractConstructionMaterials(text) {
  const lines = text.split('\n').filter(line => line.trim());
  const materials = [];
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
            importSource: 'own'
          });
        }
      }

      // Parse lines that contain materials with patterns like:
      // "2712 Workdays & 246t of Concrete"
      // "62t of Gravel 50t of Asphalt"
      // "0.062t of Mechanic comp."

      // Split on & or > and process each part - but skip parts that contain "workdays" since we already handled it
      // Skip this parsing if the line contains multiple "t of" patterns (handled by multi-material regex below)
      if (!line.match(/\d+(?:\.\d+)?t\s+of\s+.+?\s+\d+(?:\.\d+)?t\s+of/)) {
        const parts = line.split(/[&>]/);
        for (const part of parts) {
          const trimmedPart = part.trim();
          // Skip parts that contain workdays since we already handled them
          if (trimmedPart.toLowerCase().includes('workdays')) continue;

          const material = parseMaterialLine(trimmedPart);
          if (material && !materials.find(m => m.name === material.name)) {
            console.log(`  Adding from &-split: ${material.name} = ${material.quantity}`);
            materials.push(material);
          }
        }
      }

      // Also try to parse multiple materials in same line (space separated)
      // Match patterns like "62t of Gravel 50t of Asphalt" and "31t of Boards 0.062t of Mechanic comp."
      const multiMatches = [...line.matchAll(/(\d+(?:\.\d+)?)\s*t\s+of\s+([a-zA-Z\s\.]+?)(?=\s*(?:\d+(?:\.\d+)?t|\s*$))/gi)];
      if (multiMatches.length > 0) {
        for (const match of multiMatches) {
          const fullMatch = match[0]; // Full matched string like "31t of Boards"
          const material = parseMaterialLine(fullMatch);
          if (material && material.name !== 'Workdays' && !materials.find(m => m.name === material.name)) {
            console.log(`  Adding material: ${material.name} = ${material.quantity}`);
            materials.push(material);
          }
        }
      }
    }
  }

  return materials;
}

function extractProductionData(text) {
  const lines = text.split('\n').filter(line => line.trim());
  const outputs = [];
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
          quantity: quantity
        });

        maxPerDay = Math.max(maxPerDay, quantity);
      }
    }
  }

  return { outputs, maxPerDay };
}

function extractConsumptionData(text) {
  const lines = text.split('\n').filter(line => line.trim());
  const inputs = [];
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

          console.log(`  Consumption candidate: ${inputName} = ${quantity}`);

          // Skip power entries
          if (inputName.toLowerCase() === 'power') {
            console.log(`  Skipping power entry`);
            continue;
          }

          // Avoid duplicates
          if (!inputs.find(inp => inp.name === inputName)) {
            console.log(`  Adding consumption: ${inputName} = ${quantity}`);
            inputs.push({
              name: inputName,
              quantity: quantity,
              importSource: 'own'
            });
          } else {
            console.log(`  Skipping duplicate: ${inputName}`);
          }
        }
      }
    }
  }

  return { inputs };
}

function extractPollutionData(text) {
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

function extractMaxWorkers(text) {
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

  console.log('❌ No maxWorkers found, defaulting to 0');
  return 0;
}

testAllIndustryFiles();