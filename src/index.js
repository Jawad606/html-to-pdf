// index.js
const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const path = require('path');
// const fs = require('fs');

const PORT = process.env.PORT || 3000;
const PDF_DIR = path.join(__dirname, '..', 'pdfs');
const app = express();

// Accept larger payloads for full HTML pages
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

let browser; // reuse browser across requests

async function getBrowser() {
  if (browser) return browser;
  // Launch with flags appropriate for containerized environment
  browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process'
    ],
    headless: 'new' // recommended modern headless mode
  });
  return browser;
}

app.get('/', (req, res) => {
  res.send('HTML → PDF service. POST /pdf with JSON { html } or { url }');
});

/**
 * POST /pdf
 * Body: { html: "<html>...</html>", filename?: "out.pdf", url?: "https://..." }
 * Responds: application/pdf (binary)
 */
app.post('/pdf', async (req, res) => {
  console.log('Received PDF generation request');
  
  const { html, options = {} } = req.body || {};
  
  console.log('Request body length:', JSON.stringify(req.body).length);
  
  if (!html) {
    return res.status(400).json({ error: 'Please provide "html" in request body.' });
  }

  // Generate unique filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const uniqueFilename = `output-${timestamp}.pdf`;
  const outputPath = path.join(__dirname, '..', 'pdfs', uniqueFilename);

  // Ensure pdfs directory exists
  // await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  let page;
  try {
    const b = await getBrowser();
    page = await b.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log('Setting HTML content...');
    await page.setContent(html, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // ✅ Optional debug screenshot
    // await page.screenshot({ path: 'debug.png', fullPage: true });

    // Parse and validate PDF options from the request
    const pdfOptions = typeof options === 'string' ? JSON.parse(options).pdf : (options.pdf || {});
    
    // Merge with default options
    const finalPdfOptions = {
      format: 'A4',
      printBackground: true,
      margin: { top: '1mm', right: '1mm', bottom: '1mm', left: '1mm' },
      ...pdfOptions
    };

    console.log('Generating PDF with options:', finalPdfOptions);
    const pdfBuffer = await page.pdf(finalPdfOptions);

    // Ensure the pdfs directory exists
    // await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    
    // Save PDF to disk
    // await fs.promises.writeFile(outputPath, pdfBuffer);
    // console.log(`PDF saved to: ${outputPath}`);

    // Set proper headers for binary PDF data
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': `attachment; filename="${uniqueFilename}"`,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });

    // Send the PDF buffer directly as binary data
    res.write(pdfBuffer);
    res.end();
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ 
      error: 'PDF generation failed',
      details: err.message,
      stack: err.stack 
    });
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        console.error('Error closing page:', e);
      }
    }
  }
});


process.on('SIGINT', async () => {
  console.log('SIGINT received — closing browser.');
  if (browser) await browser.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received — closing browser.');
  if (browser) await browser.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`HTML→PDF service listening on port ${PORT}`);
});
