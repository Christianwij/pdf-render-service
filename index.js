import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/render', upload.single('file'), async (req, res) => {
  try {
    const pdfPath = req.file.path;
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    const pdfBuffer = fs.readFileSync(pdfPath);
    const dataUrl = 'data:application/pdf;base64,' + pdfBuffer.toString('base64');
    await page.goto(dataUrl, { waitUntil: 'networkidle0' });

    // Wait for PDF.js to load
    await page.waitForFunction('window.PDFViewerApplication && window.PDFViewerApplication.pdfDocument');
    const numPages = await page.evaluate(() => window.PDFViewerApplication.pdfDocument.numPages);

    const images = [];
    for (let i = 1; i <= numPages; i++) {
      await page.evaluate((pageNum) => {
        window.PDFViewerApplication.page = pageNum;
      }, i);
      await page.waitForTimeout(500); // Wait for page render
      const screenshot = await page.screenshot({ type: 'png', fullPage: true });
      images.push(screenshot.toString('base64'));
    }

    await browser.close();
    fs.unlinkSync(pdfPath);
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`PDF-to-image microservice running on port ${PORT}`);
}); 