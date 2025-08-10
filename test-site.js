const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Testing pilotforms.com...');
    await page.goto('https://pilotforms.com', { waitUntil: 'networkidle' });
    
    // Take a screenshot
    await page.screenshot({ path: 'site-current-state.png', fullPage: true });
    console.log('Screenshot saved as site-current-state.png');
    
    // Check for visible modals
    const visibleModals = await page.evaluate(() => {
      const modals = document.querySelectorAll('[class*="modal"], .modal, #modal');
      const visibleOnes = [];
      modals.forEach((modal, index) => {
        const style = window.getComputedStyle(modal);
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          visibleOnes.push({
            index,
            className: modal.className,
            id: modal.id,
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity
          });
        }
      });
      return visibleOnes;
    });
    
    console.log('Visible modals:', visibleModals);
    
    // Check for field palette and canvas elements
    const elements = await page.evaluate(() => {
      return {
        fieldPalette: document.querySelector('.field-palette, .sidebar, .fields-panel') ? 'Found' : 'Not found',
        canvas: document.querySelector('.canvas, .form-canvas, .drop-area') ? 'Found' : 'Not found',
        dragElements: document.querySelectorAll('[draggable="true"]').length
      };
    });
    
    console.log('Key elements:', elements);
    
    // Check CSS files loaded
    const cssFiles = await page.evaluate(() => {
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      return Array.from(links).map(link => link.href);
    });
    
    console.log('CSS files loaded:', cssFiles);
    
  } catch (error) {
    console.error('Error testing site:', error);
  }
  
  await browser.close();
})();