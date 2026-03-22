export async function exportReportToPDF(title: string, content: string): Promise<void> {
  // 1. Convert simple markdown to HTML using regex replacements
  let html = content
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    // Inline code
    .replace(/`(.*?)`/gim, '<code>$1</code>')
    // Lists (simple conversion: line starting with "- " wrapped in li, then ul)
    .replace(/^- (.*$)/gim, '<ul><li>$1</li></ul>')
    // Combine adjacent ul elements
    .replace(/<\/ul>\n<ul>/gim, '')
    // Double newlines to paragraph breaks
    .replace(/\n\n/gim, '<br><br>');

  // 2. Create a hidden print div
  const printDiv = document.createElement("div");
  // position fixed off-screen to avoid scroll issues
  printDiv.style.position = "absolute";
  printDiv.style.left = "-9999px";
  printDiv.style.top = "0";
  printDiv.style.width = "800px";
  printDiv.style.padding = "40px";
  printDiv.style.background = "white";
  printDiv.style.color = "#111";
  printDiv.style.fontFamily = "Georgia, serif";
  printDiv.style.fontSize = "14px";
  printDiv.style.lineHeight = "1.8";

  // Add customized inner style block
  printDiv.innerHTML = `
    <style>
      h1 { font-family: sans-serif; font-size: 24px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 5px; margin-bottom: 20px; color: #111; }
      h2 { font-family: sans-serif; font-size: 20px; font-weight: bold; margin-top: 30px; margin-bottom: 15px; color: #222; }
      h3 { font-family: sans-serif; font-size: 16px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #333; }
      p { margin-bottom: 15px; }
      ul { padding-left: 20px; margin-bottom: 15px; }
      li { margin-bottom: 5px; }
      strong { font-weight: bold; }
      code { font-family: monospace; background: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-size: 12.5px; }
    </style>
    <div>
      <h1>${title}</h1>
      ${html}
    </div>
  `;

  document.body.appendChild(printDiv);

  try {
    // 3. Dynamic imports to avoid SSR issues
    const { jsPDF } = await import("jspdf");
    const html2canvas = (await import("html2canvas")).default;

    // Give the DOM a tiny moment to finish layout reflow
    await new Promise(resolve => setTimeout(resolve, 50));

    // 4. Snapshot the div
    const canvas = await html2canvas(printDiv, {
      scale: 2, // High resolution
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");

    // 5. Generate A4 PDF and handle multi-page slicing
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    // Calculate the height of the image on the PDF matching aspect ratio
    const imgProps = pdf.getImageProperties(imgData);
    const canvasImgHeight = (imgProps.height * pdfWidth) / imgProps.width;

    let heightLeft = canvasImgHeight;
    let position = 0;

    // Add first page
    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, canvasImgHeight);
    heightLeft -= pdfHeight;

    // Add subsequent pages if the content extends beyond one A4 sheet
    while (heightLeft >= 0) {
      position = heightLeft - canvasImgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, canvasImgHeight);
      heightLeft -= pdfHeight;
    }

    // 6. Save the downloaded file
    const safeTitle = title.replace(/\s+/g, "-").toLowerCase();
    pdf.save(`${safeTitle}.pdf`);

  } finally {
    // 7. ALWAYS remove the hidden div from DOM
    if (document.body.contains(printDiv)) {
      document.body.removeChild(printDiv);
    }
  }
}
