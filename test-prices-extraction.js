import pkg from 'tesseract.js';
const { recognize } = pkg;

async function testPricesExtraction(imagePath) {
  try {
    console.log(`\nTesting Prices Extraction on: ${imagePath}`);
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

    // Parse like the app does
    const resources = parsePricesText(extractedText);

    console.log('\nParsed Resources:');
    console.log('='.repeat(40));
    resources.forEach((resource, index) => {
      console.log(`${index + 1}. ${resource.name}:`);
      console.log(`   NATO: Sell ${resource.prices.natoSell} | Buy ${resource.prices.natoBuy}`);
      console.log(`   USSR: Sell ${resource.prices.ussrSell} | Buy ${resource.prices.ussrBuy}`);
      console.log('');
    });

    console.log(`Total Resources Found: ${resources.length}`);

    return {
      filename: imagePath,
      extractedText,
      resources,
      totalResources: resources.length
    };

  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

function parsePricesText(text) {
  const resources = [];
  const lines = text.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const resource = parseResourceLine(line);
    if (resource) {
      resources.push(resource);
    }
  }

  return resources;
}

function parseResourceLine(line) {
  // Remove leading symbols and clean the line
  const cleanLine = line.replace(/^[^a-zA-Z]*/, '').trim();

  // Skip header lines and empty lines
  if (!cleanLine ||
      cleanLine.toLowerCase().includes('resource') ||
      cleanLine.toLowerCase().includes('sell') ||
      cleanLine.toLowerCase().includes('buy') ||
      cleanLine.toLowerCase().includes('current prices') ||
      cleanLine.toLowerCase().includes('global market') ||
      cleanLine.length < 5) {
    return null;
  }

  // Extract resource name and prices
  // Pattern: ResourceName: price1 price2 price3 price4
  const parts = cleanLine.split(':');
  if (parts.length < 2) return null;

  const resourceName = parts[0].trim();
  const pricesText = parts.slice(1).join(':').trim();

  // Extract numbers from the prices part
  const normalizedText = pricesText.replace(/(\d+),(\d{3})/g, '$1$2');
  const numberRegex = /-?\d+\.?\d*/g;
  const matches = normalizedText.match(numberRegex);

  if (!matches || matches.length < 4) return null;

  const numbers = matches.map(n => parseFloat(n)).filter(n => !isNaN(n));

  if (numbers.length >= 4) {
    // Assuming format: NATO Sell, NATO Buy, USSR Sell, USSR Buy
    return {
      name: resourceName,
      prices: {
        natoSell: numbers[0],
        natoBuy: numbers[1],
        ussrSell: numbers[2],
        ussrBuy: numbers[3]
      },
      lastUpdated: new Date().toISOString()
    };
  }

  return null;
}

// Test both Prices files
async function testAllPricesFiles() {
  console.log('🧪 Testing Prices Files Extraction');
  console.log('===================================');

  try {
    const prices1 = await testPricesExtraction('./SampleImages/Prices1.png');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause
    const prices2 = await testPricesExtraction('./SampleImages/Prices2.png');

    console.log('\n📊 SUMMARY COMPARISON');
    console.log('=====================');
    console.log(`Prices1.png: ${prices1.totalResources} resources extracted`);
    console.log(`Prices2.png: ${prices2.totalResources} resources extracted`);

    // Check for common resources
    const prices1Names = prices1.resources.map(r => r.name.toLowerCase());
    const prices2Names = prices2.resources.map(r => r.name.toLowerCase());
    const commonResources = prices1Names.filter(name => prices2Names.includes(name));

    console.log(`\nCommon Resources: ${commonResources.length}`);
    if (commonResources.length > 0) {
      console.log('Common Resources List:', commonResources.slice(0, 5).join(', '));
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAllPricesFiles();