import { Component, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OcrService } from '../ocr';
import { DatabaseService } from '../database';
import { PricesService } from '../prices';
import { IndustryService } from '../industry';

@Component({
  selector: 'app-image-upload',
  imports: [CommonModule, FormsModule],
  templateUrl: './image-upload.html',
  styleUrl: './image-upload.css'
})
export class ImageUpload {
  private ocrService = inject(OcrService);
  private databaseService = inject(DatabaseService);
  private pricesService = inject(PricesService);
  private industryService = inject(IndustryService);
  private router = inject(Router);

  @Output() dataProcessed = new EventEmitter<void>();

  selectedFiles: File[] = [];
  selectedFile: File | null = null;
  imagePreview: string | ArrayBuffer | null = null;
  isProcessing = false;
  extractedData: any = null;
  isPricesFile = false;
  isIndustryFile = false;
  showIndustryNameDialog = false;
  industryName = '';
  industryData: any = null;
  nameConflictAction: 'overwrite' | 'cancel' | 'copy' | null = null;
  selectedDataType: 'industry' | 'prices' = 'industry';
  showPricesDialog = false;
  pricesDatasetName = '';
  pricesData: any = null;

  // Multi-file processing state
  showBatchDialog = false;
  batchProgress = { current: 0, total: 0, currentFile: '' };
  batchResults: any[] = [];
  duplicates: any[] = [];
  showDuplicateDialog = false;

  onFileSelect(event: any): void {
    const files = Array.from(event.target.files as FileList);
    if (files.length === 1) {
      // Single file - use existing flow
      this.processSelectedFile(files[0]);
    } else if (files.length > 1) {
      // Multiple files - use batch processing
      this.selectedFiles = files;
      this.startBatchProcessing();
    }
  }

  onPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          // Create a new File object with a meaningful name
          const timestamp = new Date().toLocaleString().replace(/[/:]/g, '-');
          const pastedFile = new File([file], `Clipboard-Paste-${timestamp}.png`, {
            type: file.type
          });
          this.processSelectedFile(pastedFile);
        }
        break;
      }
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

      if (imageFiles.length === 1) {
        // Single file - use existing flow
        this.processSelectedFile(imageFiles[0]);
      } else if (imageFiles.length > 1) {
        // Multiple files - use batch processing
        this.selectedFiles = imageFiles;
        this.startBatchProcessing();
      } else if (imageFiles.length === 0) {
        alert('Please drop only image files.');
      }
    }
  }

  private processSelectedFile(file: File): void {
    this.selectedFile = file;
    this.extractedData = null;
    this.industryData = null;
    this.pricesData = null;
    this.showIndustryNameDialog = false;
    this.showPricesDialog = false;
    this.industryName = '';
    this.pricesDatasetName = '';

    const reader = new FileReader();
    reader.onload = (e) => {
      this.imagePreview = e.target?.result || null;
    };
    reader.readAsDataURL(file);
  }

  async extractData(): Promise<void> {
    if (!this.selectedFile) return;

    // Set flags based on radio button selection
    this.isPricesFile = this.selectedDataType === 'prices';
    this.isIndustryFile = this.selectedDataType === 'industry';

    if (this.selectedDataType === 'prices') {
      await this.extractPricesData();
    } else {
      await this.extractIndustryData();
    }
  }

  private async extractPricesData(): Promise<void> {
    this.isProcessing = true;
    try {
      const pricesData = await this.ocrService.extractPricesData(this.selectedFile!);
      if (pricesData) {
        this.pricesData = pricesData;
        // Create a cleaner default name
        let defaultName = this.selectedFile!.name.replace(/\.[^/.]+$/, ''); // Remove extension
        if (defaultName.startsWith('Clipboard-Paste-')) {
          defaultName = 'Prices-' + new Date().toLocaleDateString().replace(/\//g, '-');
        }
        this.pricesDatasetName = defaultName;
        this.showPricesDialog = true;
      } else {
        throw new Error('Failed to extract prices data from file');
      }
    } catch (error) {
      console.error('Error processing prices data:', error);
      alert('Failed to extract prices data. Please try again.');
    } finally {
      this.isProcessing = false;
    }
  }

  private async extractIndustryData(): Promise<void> {
    // This is the existing industry extraction logic
    await this.processImage();
  }

  async processImage(): Promise<void> {
    if (!this.selectedFile) return;

    this.isProcessing = true;
    try {
      if (this.isPricesFile) {
        // Handle Prices file with structured data extraction
        const pricesData = await this.ocrService.extractPricesData(this.selectedFile);
        if (pricesData) {
          // Save to prices service
          await this.pricesService.savePricesData(pricesData);

          // Also save to main OCR database with prices data included
          const extractedData = {
            id: Date.now().toString(),
            filename: this.selectedFile.name,
            extractedText: pricesData.originalText || 'Prices data extracted',
            timestamp: new Date().toISOString(),
            processed: false,
            pricesData: pricesData // Include the extracted prices data
          };

          await this.databaseService.saveData(extractedData);
          this.extractedData = extractedData;
        } else {
          throw new Error('Failed to extract prices data from file');
        }
      } else if (this.isIndustryFile) {
        // Handle Industry file with structured data extraction
        const industryData = await this.ocrService.extractIndustryData(this.selectedFile);
        if (industryData) {
          this.industryData = industryData;

          // Pre-populate industry name with building title if extracted
          if (industryData.buildings && industryData.buildings.length > 0) {
            this.industryName = industryData.buildings[0].name || '';
          }

          this.showIndustryNameDialog = true;
          this.isProcessing = false;
          return; // Wait for user to provide name
        } else {
          throw new Error('Failed to extract industry data from file');
        }
      } else {
        // Handle regular files with general OCR
        const text = await this.ocrService.extractText(this.selectedFile);

        const extractedData = {
          id: Date.now().toString(),
          filename: this.selectedFile.name,
          extractedText: text,
          timestamp: new Date().toISOString(),
          processed: false
        };

        await this.databaseService.saveData(extractedData);
        this.extractedData = extractedData;
      }

      this.dataProcessed.emit();
    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async saveIndustryWithName(): Promise<void> {
    if (!this.industryData || !this.industryName.trim()) {
      return;
    }

    this.isProcessing = true;
    try {
      this.industryData.userDefinedName = this.industryName.trim();

      const result = await this.industryService.saveIndustryData(this.industryData, this.nameConflictAction || undefined);

      if (!result.success && result.action === 'conflict') {
        // Show conflict resolution options
        const confirmed = confirm(`Industry name "${this.industryName}" already exists. Choose action:\nOK - Overwrite existing\nCancel - Choose different action`);

        if (confirmed) {
          this.nameConflictAction = 'overwrite';
          return this.saveIndustryWithName();
        } else {
          // Show options for copy or cancel
          const copyAction = confirm(`Choose action:\nOK - Create copy with new name\nCancel - Cancel operation`);
          this.nameConflictAction = copyAction ? 'copy' : 'cancel';

          if (this.nameConflictAction === 'cancel') {
            this.isProcessing = false;
            return;
          } else {
            return this.saveIndustryWithName();
          }
        }
      }

      if (result.success) {
        // Save to main OCR database with industry data included
        const extractedData = {
          id: Date.now().toString(),
          filename: this.selectedFile!.name,
          extractedText: this.industryData.extractedText,
          timestamp: new Date().toISOString(),
          processed: false,
          industryData: this.industryData
        };

        await this.databaseService.saveData(extractedData);
        this.extractedData = extractedData;

        // Reset dialog state
        this.showIndustryNameDialog = false;
        this.industryName = '';
        this.nameConflictAction = null;

        if (result.newName) {
          alert(`Industry saved as "${result.newName}"`);
        } else {
          alert(`Industry saved as "${this.industryData.userDefinedName}"`);
        }

        // Reset to fresh upload screen instead of navigating to results
        this.resetToFreshUpload();
      }
    } catch (error) {
      console.error('Error saving industry data:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  cancelIndustryNaming(): void {
    this.showIndustryNameDialog = false;
    this.industryName = '';
    this.industryData = null;
    this.nameConflictAction = null;
  }

  getOutputNames(building: any): string {
    if (!building.production?.outputs?.length) return '';
    return building.production.outputs.map((o: any) => o.name).join(', ');
  }

  getInputNames(building: any): string {
    if (!building.consumption?.inputs?.length) return '';
    return building.consumption.inputs.map((i: any) => i.name).join(', ');
  }

  async confirmPricesImport(): Promise<void> {
    if (!this.pricesData || !this.pricesDatasetName.trim()) {
      return;
    }

    this.isProcessing = true;
    try {
      // Update the filename to match the user's dataset name (no extension)
      this.pricesData.filename = this.pricesDatasetName.trim();

      // Save to prices service
      await this.pricesService.savePricesData(this.pricesData);

      // Save to main OCR database with prices data included
      const extractedData = {
        id: Date.now().toString(),
        filename: this.pricesData.filename,
        extractedText: this.pricesData.originalText || 'Prices data extracted',
        timestamp: new Date().toISOString(),
        processed: false,
        pricesData: this.pricesData
      };

      await this.databaseService.saveData(extractedData);

      // Store count before clearing
      const resourceCount = this.pricesData.totalResources || 0;

      // Reset dialog state
      this.showPricesDialog = false;
      this.pricesDatasetName = '';
      this.pricesData = null;

      alert(`Prices data imported successfully! ${resourceCount} resources added.`);

      // Reset to fresh upload screen
      this.resetToFreshUpload();

    } catch (error) {
      console.error('Error importing prices data:', error);
      alert('Failed to import prices data. Please try again.');
    } finally {
      this.isProcessing = false;
    }
  }

  cancelPricesImport(): void {
    this.showPricesDialog = false;
    this.pricesDatasetName = '';
    this.pricesData = null;
  }

  clearImage(): void {
    this.selectedFile = null;
    this.imagePreview = null;
    this.extractedData = null;
    this.selectedDataType = 'industry';
  }

  resetToFreshUpload(): void {
    // Clear all form data and state
    this.selectedFile = null;
    this.selectedFiles = [];
    this.imagePreview = null;
    this.extractedData = null;
    this.selectedDataType = 'industry';
    this.isProcessing = false;
    this.isPricesFile = false;
    this.isIndustryFile = false;

    // Clear dialog states
    this.showIndustryNameDialog = false;
    this.showPricesDialog = false;
    this.industryName = '';
    this.pricesDatasetName = '';
    this.industryData = null;
    this.pricesData = null;
    this.nameConflictAction = null;

    // Clear batch processing states
    this.showBatchDialog = false;
    this.batchProgress = { current: 0, total: 0, currentFile: '' };
    this.batchResults = [];
    this.duplicates = [];
    this.showDuplicateDialog = false;
  }

  async startBatchProcessing(): Promise<void> {
    if (this.selectedFiles.length === 0) return;

    this.batchProgress = {
      current: 0,
      total: this.selectedFiles.length,
      currentFile: ''
    };
    this.batchResults = [];
    this.duplicates = [];
    this.showBatchDialog = true;
    this.isProcessing = true;

    try {
      for (let i = 0; i < this.selectedFiles.length; i++) {
        const file = this.selectedFiles[i];
        this.batchProgress.current = i + 1;
        this.batchProgress.currentFile = file.name;

        await this.processBatchFile(file);
      }

      // Check for duplicates after processing all files
      await this.checkForDuplicates();

    } catch (error) {
      console.error('Error in batch processing:', error);
      alert('Error occurred during batch processing. Some files may not have been processed.');
    } finally {
      this.isProcessing = false;
    }
  }

  private async processBatchFile(file: File): Promise<void> {
    try {
      if (this.selectedDataType === 'prices') {
        const pricesData = await this.ocrService.extractPricesData(file);
        if (pricesData) {
          // Use filename as default name (remove extension)
          const defaultName = file.name.replace(/\.[^/.]+$/, '');
          pricesData.filename = defaultName;
          this.batchResults.push({
            type: 'prices',
            file: file,
            data: pricesData,
            defaultName: defaultName
          });
        }
      } else {
        const industryData = await this.ocrService.extractIndustryData(file);
        if (industryData) {
          // Use first building name as default industry name
          const defaultName = industryData.buildings && industryData.buildings.length > 0
            ? industryData.buildings[0].name
            : file.name.replace(/\.[^/.]+$/, '');
          industryData.userDefinedName = defaultName;
          this.batchResults.push({
            type: 'industry',
            file: file,
            data: industryData,
            defaultName: defaultName
          });
        }
      }
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      // Continue with next file even if this one fails
    }
  }

  private async checkForDuplicates(): Promise<void> {
    this.duplicates = [];

    for (const result of this.batchResults) {
      let isDuplicate = false;

      if (result.type === 'prices') {
        // Check if prices dataset with this name already exists
        const allPricesDatasets = this.pricesService.getAllDatasets();
        const existingPrices = allPricesDatasets.find(ds => ds.filename === result.defaultName);
        if (existingPrices) {
          isDuplicate = true;
        }
      } else if (result.type === 'industry') {
        // Check if industry with this name already exists
        const existingIndustry = this.industryService.getDatasetByName(result.defaultName);
        if (existingIndustry) {
          isDuplicate = true;
        }
      }

      if (isDuplicate) {
        this.duplicates.push(result);
      }
    }

    if (this.duplicates.length > 0) {
      this.showDuplicateDialog = true;
    } else {
      // No duplicates, proceed with import and complete batch processing
      await this.importAllBatchResults();
      this.completeBatchProcessing();
    }
  }

  async confirmDuplicateOverwrite(): Promise<void> {
    // User confirmed to overwrite duplicates
    await this.importAllBatchResults();
    this.showDuplicateDialog = false;
    this.completeBatchProcessing();
  }

  cancelDuplicateImport(): void {
    // Remove duplicates from batch results
    this.batchResults = this.batchResults.filter(result =>
      !this.duplicates.some(dup => dup.defaultName === result.defaultName)
    );

    if (this.batchResults.length > 0) {
      // Import non-duplicate files
      this.importAllBatchResults().then(() => {
        this.completeBatchProcessing();
      });
    } else {
      // Nothing to import
      this.completeBatchProcessing();
    }

    this.showDuplicateDialog = false;
  }

  private async importAllBatchResults(): Promise<void> {
    let successCount = 0;

    for (const result of this.batchResults) {
      try {
        if (result.type === 'prices') {
          await this.pricesService.savePricesData(result.data);

          // Save to main OCR database
          const extractedData = {
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
            filename: result.file.name,
            extractedText: result.data.originalText || 'Prices data extracted',
            timestamp: new Date().toISOString(),
            processed: false,
            pricesData: result.data
          };
          await this.databaseService.saveData(extractedData);

        } else if (result.type === 'industry') {
          await this.industryService.saveIndustryData(result.data, 'overwrite');

          // Save to main OCR database
          const extractedData = {
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
            filename: result.file.name,
            extractedText: result.data.extractedText,
            timestamp: new Date().toISOString(),
            processed: false,
            industryData: result.data
          };
          await this.databaseService.saveData(extractedData);
        }

        successCount++;
      } catch (error) {
        console.error(`Error importing ${result.file.name}:`, error);
      }
    }

    alert(`Batch import completed! ${successCount} out of ${this.batchResults.length} files imported successfully.`);
  }

  private completeBatchProcessing(): void {
    this.showBatchDialog = false;
    this.resetToFreshUpload();
    this.dataProcessed.emit();
  }
}
