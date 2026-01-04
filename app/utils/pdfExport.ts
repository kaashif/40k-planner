import type { SpawnedGroup } from '../types';

export interface PDFConfig {
  deploymentSpacing: number;    // 0-100pt - vertical gap between layouts
  pageMargin: number;            // 10-50pt - margin to edge of page
  layoutScale: number;           // 0.5-1.5 - scaling factor (50%-150%)
}

export const DEFAULT_PDF_CONFIG: PDFConfig = {
  deploymentSpacing: 20,
  pageMargin: 20,
  layoutScale: 1.0,
};

interface Layout {
  id: string;
  title: string;
  image: string;
}

const LAYOUTS: Layout[] = [
  { id: 'terraform', title: 'Round 1: Terraform', image: '/round1_terraform.png' },
  { id: 'purge', title: 'Round 2: Purge the Foe', image: '/round2_purge.png' },
  { id: 'supplies', title: 'Round 3: Hidden Supplies', image: '/round3_hidden_supplies.png' },
  { id: 'linchpin', title: 'Round 4: Linchpin', image: '/round4_linchpin.png' },
  { id: 'take', title: 'Round 5: Take and Hold', image: '/round5_take.png' },
];

// A4 dimensions in points
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

const MAP_HEIGHT_MM = 44 * 25.4; // 1117.6 mm
const MAP_WIDTH_MM = 60 * 25.4; // 1524 mm

/**
 * Create a hidden DOM container that renders a mission round with units
 * @param layout - The mission layout
 * @param groups - Current state groups to render
 * @param deploymentGroups - Optional deployment groups for diff view (ghost models + arrows)
 */
function createHiddenRenderContainer(
  layout: Layout,
  groups: SpawnedGroup[],
  deploymentGroups?: SpawnedGroup[]
): HTMLDivElement {
  const container = document.createElement('div');

  // Position off-screen
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '1600px';
  container.style.height = '1174px'; // Maintains 60:44 aspect ratio
  container.style.backgroundColor = '#0a0a0a';

  // Set background image
  container.style.backgroundImage = `url(${layout.image})`;
  container.style.backgroundSize = 'contain';
  container.style.backgroundRepeat = 'no-repeat';
  container.style.backgroundPosition = 'center';

  // Calculate scale (pixels per mm)
  const scale = 1600 / MAP_WIDTH_MM;

  // Collect labels to render at the end (on top)
  const labels: Array<{ centerX: number; bottomY: number; text: string }> = [];

  // If we have deployment groups, render ghost models and collect arrow data
  const arrows: Array<{ fromX: number; fromY: number; toX: number; toY: number; distanceInches: number }> = [];

  if (deploymentGroups && deploymentGroups.length > 0) {
    // Build map of current positions
    const currentPositions = new Map<string, { x: number; y: number }>();
    groups.forEach(group => {
      const baseSize = group.isRectangular
        ? Math.max(group.width || 25, group.length || 25)
        : (group.baseSize || 25);
      group.models.forEach(model => {
        const key = `${group.unitId}-${model.id}`;
        currentPositions.set(key, {
          x: group.groupX + model.x + (group.isRectangular ? (group.width || 25) / 2 : baseSize / 2),
          y: group.groupY + model.y + (group.isRectangular ? (group.length || 25) / 2 : baseSize / 2)
        });
      });
    });

    // Render ghost models from deployment
    deploymentGroups.forEach(group => {
      group.models.forEach(model => {
        const ghostDiv = document.createElement('div');
        ghostDiv.style.position = 'absolute';
        ghostDiv.style.zIndex = '5';

        const size = group.isRectangular && group.width && group.length
          ? { width: group.width * scale, height: group.length * scale }
          : { width: (group.baseSize || 25) * scale, height: (group.baseSize || 25) * scale };

        ghostDiv.style.left = `${group.groupX + model.x * scale}px`;
        ghostDiv.style.top = `${group.groupY + model.y * scale}px`;
        ghostDiv.style.width = `${size.width}px`;
        ghostDiv.style.height = `${size.height}px`;
        ghostDiv.style.borderRadius = group.isRectangular ? '4px' : '50%';
        ghostDiv.style.backgroundColor = 'rgba(100, 100, 100, 0.3)';
        ghostDiv.style.border = '2px dashed rgba(150, 150, 150, 0.5)';

        if (model.rotation) {
          ghostDiv.style.transform = `rotate(${model.rotation}deg)`;
          ghostDiv.style.transformOrigin = 'center center';
        }

        container.appendChild(ghostDiv);

        // Calculate arrow data
        const baseSize = group.isRectangular
          ? Math.max(group.width || 25, group.length || 25)
          : (group.baseSize || 25);
        const deployX = group.groupX + model.x + (group.isRectangular ? (group.width || 25) / 2 : baseSize / 2);
        const deployY = group.groupY + model.y + (group.isRectangular ? (group.length || 25) / 2 : baseSize / 2);

        const posKey = `${group.unitId}-${model.id}`;
        const currentPos = currentPositions.get(posKey);

        if (currentPos) {
          const dx = currentPos.x - deployX;
          const dy = currentPos.y - deployY;
          const distanceMm = Math.sqrt(dx * dx + dy * dy);

          if (distanceMm > 1) {
            arrows.push({
              fromX: deployX * scale,
              fromY: deployY * scale,
              toX: currentPos.x * scale,
              toY: currentPos.y * scale,
              distanceInches: distanceMm / 25.4
            });
          }
        }
      });
    });
  }

  // Render each group's models
  groups.forEach(group => {
    group.models.forEach(model => {
      const modelDiv = document.createElement('div');
      modelDiv.style.position = 'absolute';
      modelDiv.style.zIndex = '10';

      // Calculate size
      const size = group.isRectangular && group.width && group.length
        ? { width: group.width * scale, height: group.length * scale }
        : { width: (group.baseSize || 25) * scale, height: (group.baseSize || 25) * scale };

      // Position and style the model
      modelDiv.style.left = `${group.groupX + model.x * scale}px`;
      modelDiv.style.top = `${group.groupY + model.y * scale}px`;
      modelDiv.style.width = `${size.width}px`;
      modelDiv.style.height = `${size.height}px`;
      modelDiv.style.borderRadius = group.isRectangular ? '4px' : '50%';
      modelDiv.style.backgroundColor = '#000000';
      modelDiv.style.border = '2px solid #808080';

      // Apply rotation if present
      if (model.rotation) {
        modelDiv.style.transform = `rotate(${model.rotation}deg)`;
        modelDiv.style.transformOrigin = 'center center';
      }

      container.appendChild(modelDiv);
    });

    // Collect label data
    if (group.models.length > 0) {
      let minX = Infinity, maxX = -Infinity, maxY = -Infinity;

      group.models.forEach(model => {
        const size = group.isRectangular && group.width && group.length
          ? { width: group.width * scale, height: group.length * scale }
          : { width: (group.baseSize || 25) * scale, height: (group.baseSize || 25) * scale };

        const modelLeft = group.groupX + model.x * scale;
        const modelRight = modelLeft + size.width;
        const modelBottom = group.groupY + model.y * scale + size.height;

        minX = Math.min(minX, modelLeft);
        maxX = Math.max(maxX, modelRight);
        maxY = Math.max(maxY, modelBottom);
      });

      labels.push({
        centerX: (minX + maxX) / 2,
        bottomY: maxY + 2,
        text: group.unitName
      });
    }
  });

  // Render arrows as SVG
  if (arrows.length > 0) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.zIndex = '15';
    svg.style.pointerEvents = 'none';

    // Add arrowhead marker
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'pdf-arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    polygon.setAttribute('fill', '#3b82f6');
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);

    arrows.forEach(arrow => {
      // Arrow line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(arrow.fromX));
      line.setAttribute('y1', String(arrow.fromY));
      line.setAttribute('x2', String(arrow.toX));
      line.setAttribute('y2', String(arrow.toY));
      line.setAttribute('stroke', '#3b82f6');
      line.setAttribute('stroke-width', '3');
      line.setAttribute('marker-end', 'url(#pdf-arrowhead)');
      svg.appendChild(line);

      // Distance label
      const midX = (arrow.fromX + arrow.toX) / 2;
      const midY = (arrow.fromY + arrow.toY) / 2;

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(midX));
      text.setAttribute('y', String(midY - 8));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', '#3b82f6');
      text.setAttribute('font-size', '14');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('stroke', 'black');
      text.setAttribute('stroke-width', '3');
      text.setAttribute('paint-order', 'stroke');
      text.textContent = `${arrow.distanceInches.toFixed(1)}"`;
      svg.appendChild(text);
    });

    container.appendChild(svg);
  }

  // Render all labels last (on top layer)
  labels.forEach(label => {
    const labelDiv = document.createElement('div');
    labelDiv.style.position = 'absolute';
    labelDiv.style.zIndex = '100';
    labelDiv.style.left = `${label.centerX}px`;
    labelDiv.style.top = `${label.bottomY}px`;
    labelDiv.style.transform = 'translateX(-50%)';
    labelDiv.style.color = '#ffffff';
    labelDiv.style.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
    labelDiv.style.fontSize = '12px';
    labelDiv.style.fontWeight = '600';
    labelDiv.style.whiteSpace = 'nowrap';
    labelDiv.textContent = label.text;

    container.appendChild(labelDiv);
  });

  return container;
}

/**
 * Capture a DOM container as an image using html2canvas
 */
async function captureContainerAsImage(container: HTMLDivElement): Promise<string> {
  // Dynamically import html2canvas
  const { default: html2canvas } = await import('html2canvas');

  // Wait for fonts to load
  await document.fonts.ready;

  // Capture the container
  const canvas = await html2canvas(container, {
    logging: false,
    allowTaint: true,
    useCORS: true
  } as any);

  // Convert to data URL
  return canvas.toDataURL('image/png');
}

/**
 * Generate a PDF with all tournament rounds
 * Shows deployment on top half and turn 1 on bottom half for each round
 */
export async function generateTournamentPDF(
  spawnedGroupsByRoundAndTurn: { [key: string]: SpawnedGroup[] },
  onProgress?: (current: number, total: number) => void,
  config: PDFConfig = DEFAULT_PDF_CONFIG
): Promise<void> {
  // Dynamically import jsPDF
  const { default: jsPDF } = await import('jspdf');

  // Create PDF instance in portrait
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  // Calculate layout dimensions - full width, half height each
  const layoutWidth = (A4_WIDTH - 2 * config.pageMargin) * config.layoutScale;
  const layoutHeight = (layoutWidth * 44 / 60); // Maintain 60:44 aspect ratio

  // Vertical spacing
  const titleHeight = 25;
  const labelHeight = 15;
  const gap = config.deploymentSpacing;

  let isFirstPage = true;

  for (let i = 0; i < LAYOUTS.length; i++) {
    const layout = LAYOUTS[i];

    // Report progress
    onProgress?.(i + 1, LAYOUTS.length);

    // Create containers for deployment and turn 1
    const deploymentGroups = spawnedGroupsByRoundAndTurn[`${layout.id}-deployment`] || [];
    const turn1Groups = spawnedGroupsByRoundAndTurn[`${layout.id}-turn1`] || [];

    // Deployment view without diff, Turn 1 view with diff (ghost models + arrows)
    const deploymentContainer = createHiddenRenderContainer(layout, deploymentGroups);
    const turn1Container = createHiddenRenderContainer(layout, turn1Groups, deploymentGroups);

    // Append to body (required for html2canvas)
    document.body.appendChild(deploymentContainer);
    document.body.appendChild(turn1Container);

    // Wait a moment for rendering
    await new Promise(resolve => setTimeout(resolve, 100));

    // Capture both as images
    const deploymentImage = await captureContainerAsImage(deploymentContainer);
    const turn1Image = await captureContainerAsImage(turn1Container);

    // Remove containers
    document.body.removeChild(deploymentContainer);
    document.body.removeChild(turn1Container);

    // Add new page if needed
    if (!isFirstPage) {
      pdf.addPage();
    }

    // Calculate positions
    const topY = config.pageMargin;
    const deploymentLabelY = topY + titleHeight;
    const deploymentImageY = deploymentLabelY + labelHeight;
    const turn1LabelY = deploymentImageY + layoutHeight + gap;
    const turn1ImageY = turn1LabelY + labelHeight;

    // Add round title (centered)
    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);
    pdf.text(layout.title, A4_WIDTH / 2, topY + 10, { align: 'center' });

    // Add deployment label
    pdf.setFontSize(11);
    pdf.text('Deployment', config.pageMargin, deploymentLabelY + 10);

    // Add deployment image (top)
    pdf.addImage(
      deploymentImage,
      'PNG',
      config.pageMargin,
      deploymentImageY,
      layoutWidth,
      layoutHeight
    );

    // Add turn 1 label
    pdf.text('Turn 1', config.pageMargin, turn1LabelY + 10);

    // Add turn 1 image (bottom)
    pdf.addImage(
      turn1Image,
      'PNG',
      config.pageMargin,
      turn1ImageY,
      layoutWidth,
      layoutHeight
    );

    if (isFirstPage) isFirstPage = false;
  }

  // Generate filename with timestamp
  const date = new Date().toISOString().split('T')[0];
  const filename = `40k-tournament-plan-${date}.pdf`;

  // Save PDF
  pdf.save(filename);
}
