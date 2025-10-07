// index.js
const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');

const PORT = process.env.PORT || 3000;
const app = express();

// Accept larger payloads for full HTML pages
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

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
  const { html, url, filename = 'output.pdf', options = {} } = req.body || {};

  if (!html && !url) {
    return res.status(400).json({ error: 'Please provide either "html" or "url" in request body.' });
  }

  let page;
  try {
    const b = await getBrowser();
    page = await b.newPage();

    // set a default viewport (optional)
    await page.setViewport({ width: 1280, height: 800 });

    if (url) {
      // navigate to URL
      const gotoOptions = { waitUntil: 'networkidle0', timeout: 30000 };
      await page.goto(url, gotoOptions);
    } else {
      // set provided HTML
      // base URL can be provided to resolve relative assets
      const base = options.base || 'about:blank';
      await page.setContent(html, { waitUntil: 'networkidle0' });
      // give time for client-side JS if necessary (optional)
      if (options.waitForMillis && typeof options.waitForMillis === 'number') {
        await page.waitForTimeout(options.waitForMillis);
      }
    }

    // PDF options with sensible defaults
    const pdfOptions = {
      format: options.format || 'A4',
      printBackground: options.printBackground !== undefined ? options.printBackground : true,
      margin: options.margin || { top: '15mm', right: '10mm', bottom: '15mm', left: '10mm' },
      timeout: options.timeout || 30000,
      ...options.pdf // if user passes a 'pdf' object override
    };

    const pdfBuffer = await page.pdf(pdfOptions);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': `attachment; filename="${filename}"`
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'PDF generation failed', details: err.message });
  } finally {
    if (page) {
      try { await page.close(); } catch (e) {}
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
