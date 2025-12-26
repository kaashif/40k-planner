import type { SpawnedGroup } from '../types';

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

const PDF_CONFIG = {
  pageWidth: 595.28,   // A4 width in points
  pageHeight: 841.89,  // A4 height in points
  margin: 20,
  layoutWidth: 555.28,
  layoutHeight: 407,   // Maintains 60:44 aspect ratio
};

const MAP_HEIGHT_MM = 44 * 25.4; // 1117.6 mm
const MAP_WIDTH_MM = 60 * 25.4; // 1524 mm

/**
 * Create a hidden DOM container that renders a mission round with units
 */
function createHiddenRenderContainer(
  layout: Layout,
  groups: SpawnedGroup[]
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

  // Render each group's models
  groups.forEach(group => {
    group.models.forEach(model => {
      const modelDiv = document.createElement('div');
      modelDiv.style.position = 'absolute';

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

    // Add unit label
    if (group.models.length > 0) {
      // Calculate bounding box of all models in this group
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

      // Position label at center-bottom of bounding box
      const centerX = (minX + maxX) / 2;
      const bottomY = maxY + 2;

      const labelDiv = document.createElement('div');
      labelDiv.style.position = 'absolute';
      labelDiv.style.left = `${centerX}px`;
      labelDiv.style.top = `${bottomY}px`;
      labelDiv.style.transform = 'translateX(-50%)';
      labelDiv.style.color = '#ffffff';
      labelDiv.style.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
      labelDiv.style.fontSize = '12px';
      labelDiv.style.fontWeight = '600';
      labelDiv.style.whiteSpace = 'nowrap';
      labelDiv.textContent = group.unitName;

      container.appendChild(labelDiv);
    }
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
    backgroundColor: '#0a0a0a',
    scale: 2,  // Higher resolution
    logging: false,
    allowTaint: true,
    useCORS: true
  });

  // Convert to data URL
  return canvas.toDataURL('image/png');
}

/**
 * Generate a PDF with all tournament rounds
 */
export async function generateTournamentPDF(
  spawnedGroupsByRound: { [roundId: string]: SpawnedGroup[] },
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  // Dynamically import jsPDF
  const { default: jsPDF } = await import('jspdf');

  // Create PDF instance
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  let isFirstPage = true;

  for (let i = 0; i < LAYOUTS.length; i++) {
    const layout = LAYOUTS[i];

    // Report progress
    onProgress?.(i + 1, LAYOUTS.length);

    // Create hidden container
    const container = createHiddenRenderContainer(
      layout,
      spawnedGroupsByRound[layout.id] || []
    );

    // Append to body (required for html2canvas)
    document.body.appendChild(container);

    // Wait a moment for rendering
    await new Promise(resolve => setTimeout(resolve, 100));

    // Capture as image
    const imageData = await captureContainerAsImage(container);

    // Remove container
    document.body.removeChild(container);

    // Determine position (top or bottom)
    const isTopPosition = i % 2 === 0;

    // Add new page if needed
    if (!isFirstPage && isTopPosition) {
      pdf.addPage();
    }

    // Calculate y position
    const yPosition = isTopPosition
      ? PDF_CONFIG.margin
      : PDF_CONFIG.pageHeight / 2 + PDF_CONFIG.margin / 2;

    // Add title above layout
    pdf.setFontSize(12);
    pdf.setTextColor(57, 255, 20); // Neon green
    pdf.text(layout.title, PDF_CONFIG.pageWidth / 2, yPosition - 10, {
      align: 'center'
    });

    // Add image to PDF
    pdf.addImage(
      imageData,
      'PNG',
      PDF_CONFIG.margin,
      yPosition,
      PDF_CONFIG.layoutWidth,
      PDF_CONFIG.layoutHeight
    );

    if (isFirstPage) isFirstPage = false;
  }

  // Generate filename with timestamp
  const date = new Date().toISOString().split('T')[0];
  const filename = `40k-tournament-plan-${date}.pdf`;

  // Save PDF
  pdf.save(filename);
}
