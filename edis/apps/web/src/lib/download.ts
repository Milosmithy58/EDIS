import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export type ExportFormat = 'pdf' | 'docx';

const sanitizeFilename = (input: string, fallback: string) => {
  const trimmed = input.trim();
  const safeBase = trimmed.length > 0 ? trimmed : fallback;
  return safeBase
    .toLowerCase()
    .replace(/[^a-z0-9\-_.\s]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

export const downloadElementAsPdf = async (element: HTMLElement, filename: string) => {
  // Try to ensure full content is captured by setting width/height to scroll dimensions
  const initialWidth = element.scrollWidth;
  const initialHeight = element.scrollHeight;

  const canvas = await html2canvas(element, {
    scale: 2, // Increase scale for better resolution
    useCORS: true, // Handle images from other origins
    logging: false, // Disable html2canvas logs
    width: initialWidth,    // Explicitly set width
    height: initialHeight,  // Explicitly set height
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4'); // 'p' for portrait, 'mm' for millimeters, 'a4' for A4 size

  const imgWidth = 210; // A4 width in mm
  const pageHeight = 295; // A4 height in mm

  const aspectRatio = canvas.width / canvas.height;
  let imgHeight = imgWidth / aspectRatio; // Calculate imgHeight based on aspect ratio
  
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(`${sanitizeFilename(filename, 'edis-export')}.pdf`);
};

export const downloadElementAsDocx = async (element: HTMLElement, filename: string) => {
  const content = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${element.outerHTML}</body></html>`;
  const blob = new Blob(['\ufeff', content], {
    type: 'application/msword',
  });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${sanitizeFilename(filename, 'edis-export')}.docx`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const createExportFilename = (base: string, suffix: string) => {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${sanitizeFilename(base, 'edis-export')}-${suffix}-${timestamp}`;
};
