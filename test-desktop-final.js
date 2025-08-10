const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Testing final desktop experience on pilotforms.com...');
    
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    await page.goto('https://pilotforms.com', { waitUntil: 'networkidle' });
    
    // Wait for desktop detection
    await page.waitForTimeout(1000);
    
    // Take full page screenshot
    await page.screenshot({ path: 'desktop-final.png', fullPage: false });
    console.log('Desktop screenshot saved as desktop-final.png');
    
    // Test key functionality
    const desktopTest = await page.evaluate(() => {
      const results = {
        windowSize: { width: window.innerWidth, height: window.innerHeight },
        mobileDisplay: document.getElementById('mobileLandingPage')?.style.display || 'none',
        desktopDisplay: document.getElementById('desktopApplication')?.style.display || 'block',
        sidebarVisible: !!document.querySelector('.sidebar:not([style*="display: none"])'),
        canvasVisible: !!document.querySelector('.form-canvas'),
        propertiesVisible: !!document.querySelector('.properties-panel'),
        fieldCount: document.querySelectorAll('.field-block').length,
        scrollElements: {
          bodyOverflow: window.getComputedStyle(document.body).overflow,
          sidebarHeight: document.querySelector('.sidebar')?.scrollHeight || 0,
          sidebarClientHeight: document.querySelector('.sidebar')?.clientHeight || 0
        }
      };
      
      // Test if sidebar needs scrolling
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        results.sidebarScrollNeeded = sidebar.scrollHeight > sidebar.clientHeight;
      }
      
      // Test if properties panel needs scrolling
      const properties = document.querySelector('.properties-panel');
      if (properties) {
        results.propertiesScrollNeeded = properties.scrollHeight > properties.clientHeight;
      }
      
      return results;
    });
    
    console.log('Desktop functionality test:', JSON.stringify(desktopTest, null, 2));
    
    // Test drag and drop availability
    const dragTest = await page.evaluate(() => {
      const draggableElements = document.querySelectorAll('[draggable="true"]');
      return {
        draggableCount: draggableElements.length,
        firstDraggableType: draggableElements[0]?.getAttribute('data-field-type') || 'none'
      };
    });
    
    console.log('Drag and drop test:', dragTest);
    
    // Test responsive behavior by resizing
    console.log('Testing window resize behavior...');
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.waitForTimeout(500);
    
    const resizeTest = await page.evaluate(() => {
      return {
        windowWidth: window.innerWidth,
        mobilePageVisible: document.getElementById('mobileLandingPage')?.style.display === 'flex',
        desktopAppVisible: document.getElementById('desktopApplication')?.style.display !== 'none'
      };
    });
    
    console.log('Resize test (1000px width):', resizeTest);
    
  } catch (error) {
    console.error('Error testing desktop site:', error);
  }
  
  await browser.close();
})();