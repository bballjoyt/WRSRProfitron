# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a WRSR (Workers & Resources: Soviet Republic) game helper tool with dual architecture:

1. **Root Level**: Node.js OCR testing scripts using Tesseract.js
2. **image-parser-calculator/**: Angular 20 web application for image processing and resource calculations

## Common Development Commands

### Root Level (OCR Testing)
```bash
# Run OCR tests on sample images
node test-ocr.js
node test-improved-ocr.js
node test-prices-extraction.js
```

### Angular Application (image-parser-calculator/)
```bash
# Navigate to the Angular app
cd image-parser-calculator

# Start development server
ng serve

# Build the application
ng build

# Run tests
ng test

# Generate new components
ng generate component component-name
```

## Architecture Overview

### Core Functionality
The application processes game screenshots to extract economic data using OCR (Optical Character Recognition) with Tesseract.js. It handles two main data types:

1. **Price Data**: Market prices for resources (NATO/USSR buy/sell prices)
2. **Industry Data**: Building costs, production rates, and profitability calculations

### Key Components Structure

#### Data Models (`src/app/models/`)
- `prices.model.ts`: Defines interfaces for resource prices, datasets, and storage
- `industry.model.ts`: Defines building data, resource requirements, and profitability metrics

#### Core Services (`src/app/`)
- `ocr.ts`: Tesseract.js integration for text extraction from images
- `database.ts`: Local storage management using LowDB
- `prices.ts`: Price data parsing logic
- `industry.ts`: Industry data parsing and calculations

#### UI Components (`src/app/`)
- `image-upload/`: File upload and processing interface
- `calculation-results/`: Display processed data and calculations
- `prices-manager/`: Manage and view price datasets
- `industry-manager/`: Manage industry building data

#### App Navigation
The main app uses a simple view-based navigation system with four views:
- `upload`: Image upload interface
- `results`: Show calculation results
- `prices`: Price data management
- `industry`: Industry data management

### OCR Processing Pipeline
1. Image upload through drag-and-drop or file picker
2. Tesseract.js processes image with 'eng' language model
3. Text extraction with progress tracking
4. Pattern matching for numbers and resource names
5. Data parsing into structured formats (prices or industry data)
6. Storage in local database
7. Display of results with calculations

### Data Processing Logic
- **Price Extraction**: Parses "ResourceName: NATO_sell NATO_buy USSR_sell USSR_buy" format
- **Number Handling**: Supports comma-separated thousands (e.g., "1,885.28")
- **Industry Calculations**: Computes profitability, daily/monthly/yearly profits, cost analysis

## Dependencies
- **Angular 20.3**: Main framework with standalone components
- **Tesseract.js 6.0.1**: OCR processing
- **LowDB 7.0.1**: Local JSON database
- **RxJS**: Reactive programming
- **Prettier**: Code formatting (printWidth: 100, singleQuote: true)

## Sample Data
The `SampleImages/` directory contains test images:
- `Industry*.png`: Building and production data screenshots
- `Prices*.png`: Market prices screenshots

## Testing Approach
- Uses Karma + Jasmine for unit testing
- OCR testing scripts validate extraction accuracy against sample images
- No custom test commands - uses standard Angular CLI testing