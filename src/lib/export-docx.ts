export async function exportReportToDOCX(title: string, content: string): Promise<void> {
  const html = content
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/`(.*?)`/gim, '<code>$1</code>')
    .replace(/^- (.*$)/gim, '<ul><li>$1</li></ul>')
    .replace(/<\/ul>\n<ul>/gim, '')
    .replace(/\n\n/gim, '<br><br>');

  const doc = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${title}</title>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<style>
  body { font-family: Georgia, serif; font-size: 12pt; line-height: 1.6; color: #111; }
  h1 { font-family: Calibri, sans-serif; font-size: 22pt; border-bottom: 2px solid #333; padding-bottom: 6px; margin-bottom: 16pt; }
  h2 { font-family: Calibri, sans-serif; font-size: 16pt; margin-top: 18pt; margin-bottom: 10pt; }
  h3 { font-family: Calibri, sans-serif; font-size: 13pt; margin-top: 12pt; margin-bottom: 6pt; }
  code { font-family: Consolas, monospace; background: #f4f4f4; padding: 2px 4px; }
  ul { margin-left: 20pt; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #999; padding: 6px; }
  th { background: #eee; }
</style>
</head>
<body>
<h1>${title}</h1>
${html}
</body>
</html>`;

  const blob = new Blob(['﻿', doc], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
