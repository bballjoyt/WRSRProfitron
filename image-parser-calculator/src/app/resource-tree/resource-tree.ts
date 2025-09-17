import { Component, OnInit, inject, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ResourceTreeService } from '../resource-tree.service';
import { ResourceTree, ProductionChain, ChainBuilding } from '../models/resource-tree.model';
import { hierarchy, tree, HierarchyNode } from 'd3-hierarchy';
import { select, Selection } from 'd3-selection';

interface TreeNode {
  name: string;
  building: ChainBuilding;
  children?: TreeNode[];
  ratio: number;
  connections: { target: string; resource: string; quantity: number }[];
}

@Component({
  selector: 'app-resource-tree',
  imports: [CommonModule],
  templateUrl: './resource-tree.html',
  styleUrl: './resource-tree.css'
})
export class ResourceTreeComponent implements OnInit, AfterViewInit {
  @ViewChild('treeContainer', { static: false }) treeContainer!: ElementRef;

  private resourceTreeService = inject(ResourceTreeService);

  resourceTree: ResourceTree | null = null;
  loading = false;
  error: string | null = null;
  showDetailedView = false;
  private svg: Selection<SVGSVGElement, unknown, null, undefined> | null = null;

  ngOnInit(): void {
    this.generateTree();
  }

  ngAfterViewInit(): void {
    if (this.resourceTree) {
      this.renderD3Trees();
    }
  }

  generateTree(): void {
    this.loading = true;
    this.error = null;

    try {
      this.resourceTree = this.resourceTreeService.generateResourceTree();
      console.log('Generated resource tree:', this.resourceTree);

      // Render D3 trees after data is loaded
      setTimeout(() => {
        if (this.treeContainer) {
          this.renderD3Trees();
        }
      }, 0);
    } catch (error) {
      console.error('Error generating resource tree:', error);
      this.error = 'Failed to generate resource tree. Make sure you have industry and price data loaded.';
    } finally {
      this.loading = false;
    }
  }

  toggleView(): void {
    this.showDetailedView = !this.showDetailedView;
  }

  getChains(): ProductionChain[] {
    return this.resourceTree?.chains || [];
  }

  getIsolatedBuildings(): ChainBuilding[] {
    return this.resourceTree?.isolatedBuildings || [];
  }

  getTotalBuildings(): number {
    let total = this.getIsolatedBuildings().length;
    this.getChains().forEach(chain => {
      total += chain.buildings.length;
    });
    return total;
  }

  formatRatio(ratio: number): string {
    return ratio.toFixed(2);
  }

  getInputSummary(building: ChainBuilding): string {
    if (building.inputs.length === 0) return 'No inputs';

    return building.inputs.map(input => {
      const sourceInfo = input.sourceType === 'building' && input.sourceBuilding
        ? ` (from ${input.sourceBuilding})`
        : ` (from market)`;

      return `${input.resourceName}: ${this.formatRatio(input.quantity)}${sourceInfo}`;
    }).join('; ');
  }

  getOutputSummary(building: ChainBuilding): string {
    if (building.outputs.length === 0) return 'No outputs';

    return building.outputs.map(output =>
      `${output.resourceName}: ${this.formatRatio(output.quantity)}`
    ).join(', ');
  }

  getChainLevels(chain: ProductionChain): ChainBuilding[][] {
    const levels: ChainBuilding[][] = [];
    const maxLevel = Math.max(...chain.buildings.map(b => b.level));

    for (let i = 0; i <= maxLevel; i++) {
      levels[i] = chain.buildings.filter(b => b.level === i);
    }

    return levels;
  }

  generateConnectionLines(chain: ProductionChain): string {
    let pathData = '';

    chain.buildings.forEach(building => {
      building.outputs.forEach(output => {
        output.consumers.forEach(consumerName => {
          const consumer = chain.buildings.find(b => b.name === consumerName);
          if (consumer) {
            // Create SVG path from building to consumer
            const startX = building.position.x + 75; // Center of building card (150px wide)
            const startY = building.position.y + 100; // Bottom of building card
            const endX = consumer.position.x + 75;
            const endY = consumer.position.y; // Top of consumer card

            pathData += `M ${startX} ${startY} L ${endX} ${endY} `;
          }
        });
      });
    });

    return pathData;
  }

  getMarketInputsForBuilding(building: ChainBuilding): string {
    const marketInputs = building.inputs
      .filter(input => input.sourceType === 'market')
      .map(input => input.resourceName);
    return marketInputs.join(', ') || 'None';
  }

  private renderD3Trees(): void {
    if (!this.resourceTree || !this.treeContainer) return;

    // Clear existing SVG
    select(this.treeContainer.nativeElement).selectAll('svg').remove();

    this.resourceTree.chains.forEach((chain, index) => {
      this.renderChainTree(chain, index);
    });
  }

  private renderChainTree(chain: ProductionChain, index: number): void {
    const containerWidth = 1400; // Increased width to use more space
    const containerHeight = 800; // Increased height to prevent cutoff
    const nodeWidth = 280;
    const nodeHeight = 220; // Slightly increased node height

    // Create SVG for this chain
    const svg = select(this.treeContainer.nativeElement)
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', containerHeight)
      .style('border', '1px solid #ddd')
      .style('margin-bottom', '20px')
      .style('background', '#f8f9fa');

    // Add chain title
    svg.append('text')
      .attr('x', containerWidth / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text(chain.name);

    // Convert chain to D3 tree structure
    const treeData = this.buildTreeData(chain);
    const root = hierarchy(treeData);

    // Create tree layout
    const treeLayout = tree<TreeNode>()
      .size([containerWidth - 100, containerHeight - 100]);

    const treeNodes = treeLayout(root);

    // Create group for the tree
    const g = svg.append('g')
      .attr('transform', 'translate(50, 60)');

    // Draw links with ratio labels
    const links = g.selectAll('.link')
      .data(treeNodes.links())
      .enter()
      .append('g')
      .attr('class', 'link');

    // Draw connection lines
    links.append('path')
      .attr('d', d => {
        const sourceX = d.source.x;
        const sourceY = d.source.y + nodeHeight / 2;
        const targetX = d.target.x;
        const targetY = d.target.y - 10;

        return `M${sourceX},${sourceY}
                C${sourceX},${(sourceY + targetY) / 2}
                 ${targetX},${(sourceY + targetY) / 2}
                 ${targetX},${targetY}`;
      })
      .style('fill', 'none')
      .style('stroke', '#007bff')
      .style('stroke-width', 2);

    // Add ratio labels on connections
    links.append('text')
      .attr('x', d => (d.source.x + d.target.x) / 2)
      .attr('y', d => (d.source.y + d.target.y) / 2 + nodeHeight / 4)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#007bff')
      .style('background', 'white')
      .text(d => {
        const ratio = d.target.data.ratio;
        const connections = d.target.data.connections;
        if (connections.length > 0) {
          const connection = connections[0];
          return `${ratio.toFixed(2)}x → ${connection.resource}`;
        }
        return `${ratio.toFixed(2)}x`;
      });

    // Create HTML nodes using foreignObject
    const nodes = g.selectAll('.node')
      .data(treeNodes.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x - nodeWidth/2}, ${d.y})`);

    // Add building cards as foreign objects
    nodes.append('foreignObject')
      .attr('width', nodeWidth)
      .attr('height', nodeHeight)
      .html(d => this.generateCardHTML(d.data.building));
  }

  private buildTreeData(chain: ProductionChain): TreeNode {
    // Find the final product (level 0)
    const finalProduct = chain.buildings.find(b => b.level === 0);
    if (!finalProduct) {
      throw new Error('No final product found in chain');
    }

    const visited = new Set<string>();

    const buildNode = (building: ChainBuilding): TreeNode => {
      if (visited.has(building.name)) {
        return {
          name: building.name,
          building,
          ratio: building.ratio,
          connections: []
        };
      }

      visited.add(building.name);

      const children: TreeNode[] = [];
      const connections: { target: string; resource: string; quantity: number }[] = [];

      // Find buildings that supply to this building
      building.inputs.forEach(input => {
        if (input.sourceType === 'building' && input.sourceBuilding) {
          const supplierBuilding = chain.buildings.find(b => b.name === input.sourceBuilding);
          if (supplierBuilding && !visited.has(supplierBuilding.name)) {
            children.push(buildNode(supplierBuilding));
            connections.push({
              target: supplierBuilding.name,
              resource: input.resourceName,
              quantity: input.quantity
            });
          }
        }
      });

      return {
        name: building.name,
        building,
        children: children.length > 0 ? children : undefined,
        ratio: building.ratio,
        connections
      };
    };

    return buildNode(finalProduct);
  }

  private generateCardHTML(building: ChainBuilding): string {
    const levelClass = building.level === 0 ? 'final-product' : 'intermediate';

    const inputsHTML = building.inputs.map(input => {
      const sourceClass = input.sourceType === 'market' ? 'market-source' : 'building-source';
      const sourceText = input.sourceType === 'market' ? 'Market' : input.sourceBuilding;

      return `
        <div class="resource-item">
          <span class="resource-name">${input.resourceName}</span>
          <span class="resource-quantity">${input.quantity.toFixed(2)}</span>
          <span class="resource-source ${sourceClass}">${sourceText}</span>
        </div>
      `;
    }).join('');

    const outputsHTML = building.outputs.map(output => {
      const finalText = output.consumers.length === 0 ? 'Final Product' : `→ ${output.consumers.join(', ')}`;
      const finalClass = output.consumers.length === 0 ? 'final-product' : '';

      return `
        <div class="resource-item">
          <span class="resource-name">${output.resourceName}</span>
          <span class="resource-quantity">${output.quantity.toFixed(2)}</span>
          <span class="resource-consumers ${finalClass}">${finalText}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="building-card ${levelClass}" style="width: 100%; height: 100%; border: 2px solid ${building.level === 0 ? '#28a745' : '#007bff'}; border-radius: 8px; padding: 10px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div class="building-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #eee;">
          <h5 style="margin: 0; color: #333; font-size: 14px; font-weight: 600;">${building.name}</h5>
          <span class="ratio-badge" style="background-color: #007bff; color: white; padding: 3px 8px; border-radius: 10px; font-size: 12px; font-weight: bold;">${building.ratio.toFixed(2)}x</span>
        </div>

        ${building.inputs.length > 0 ? `
          <div class="resource-flow inputs" style="margin: 8px 0;">
            <div class="flow-label" style="font-weight: 600; color: #555; margin-bottom: 4px; font-size: 11px;">Inputs:</div>
            <div class="resource-list" style="display: flex; flex-direction: column; gap: 2px;">
              ${inputsHTML}
            </div>
          </div>
        ` : ''}

        ${building.outputs.length > 0 ? `
          <div class="resource-flow outputs" style="margin: 8px 0;">
            <div class="flow-label" style="font-weight: 600; color: #555; margin-bottom: 4px; font-size: 11px;">Outputs:</div>
            <div class="resource-list" style="display: flex; flex-direction: column; gap: 2px;">
              ${outputsHTML}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  exportTreeData(): void {
    if (!this.resourceTree) return;

    const exportData = {
      resourceTree: this.resourceTree,
      generatedAt: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `resource_tree_${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    URL.revokeObjectURL(url);
  }
}