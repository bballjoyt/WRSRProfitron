import pkg from 'tesseract.js';
const { recognize } = pkg;

async function testImprovedOCR(imagePath) {
  try {
    console.log(`\nTesting Improved OCR on: ${imagePath}`);
    console.log('='.repeat(50));

    const result = await recognize(imagePath, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    const extractedText = result.data.text;
    console.log('\nExtracted Text:');
    console.log(extractedText);

    // Improved number extraction - handle comma-separated thousands
    function extractNumbers(text) {
      // First, handle comma-separated thousands (e.g., "1,885.28" -> "1885.28")
      const normalizedText = text.replace(/(\d+),(\d{3})/g, '$1$2');

      // Match numbers including decimals, but exclude standalone commas
      const numberRegex = /\d+\.?\d*/g;
      const matches = normalizedText.match(numberRegex);
      return matches ? matches.map(n => parseFloat(n)).filter(n => !isNaN(n)) : [];
    }

    const numbers = extractNumbers(extractedText);

    console.log('\nExtracted Numbers (Improved):');
    console.log(numbers);

    if (numbers.length > 0) {
      const calculations = {
        numbers: numbers,
        sum: numbers.reduce((a, b) => a + b, 0),
        average: numbers.reduce((a, b) => a + b, 0) / numbers.length,
        min: Math.min(...numbers),
        max: Math.max(...numbers),
        count: numbers.length
      };

      console.log('\nCalculations:');
      console.log(calculations);

      return {
        filename: imagePath,
        extractedText,
        numbers,
        calculations
      };
    } else {
      console.log('\nNo numbers found in the extracted text');
      return {
        filename: imagePath,
        extractedText,
        numbers: [],
        message: 'No numbers found'
      };
    }
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

// Test with the second sample image using improved logic
testImprovedOCR('./SampleImages/Screenshot 2025-09-13 214921.png')
  .then(result => {
    console.log('\nFinal Result (Improved):');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('Test failed:', error);
  });