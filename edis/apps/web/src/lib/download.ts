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
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1000,height=800');
  if (!printWindow) {
    throw new Error('Pop-up blocked by the browser');
  }

  const serialized = element.outerHTML;

  // Extract only stylesheet links and style blocks from the main document's head
  const stylesheets = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
    .map(node => node.outerHTML)
    .join('\n');

  printWindow.document.open();
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${filename}</title>
        ${stylesheets}
        <style>
          /* Basic print-specific styles */
          body { margin: 24px; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
          * { box-sizing: border-box; }
        </style>
      </head>
      <body>${serialized}</body>
    </html>
  `);
  printWindow.document.close();
  
  // Longer delay to ensure content and styles are loaded and rendered
  await new Promise(resolve => setTimeout(resolve, 2000)); // Increased to 2 seconds
  
  printWindow.focus();
  printWindow.print();
  
  setTimeout(() => printWindow.close(), 2500); // Close window after a slightly longer delay
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
