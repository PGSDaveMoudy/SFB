const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Testing ultra-compact layout at 100% zoom...');
    
    // Test standard desktop at 100% zoom
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('https://pilotforms.com', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    
    // Take screenshot at 100% zoom
    await page.screenshot({ path: 'ultra-compact-100.png', fullPage: false });
    console.log('Screenshot saved at 100% zoom');
    
    // Test if everything fits without scrolling
    const layoutTest = await page.evaluate(() => {
      const body = document.body;
      const container = document.querySelector('.container');
      const sidebar = document.querySelector('.sidebar');
      const mainContent = document.querySelector('.main-content');
      const properties = document.querySelector('.properties-panel');
      const header = document.querySelector('.top-header');
      
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        bodyOverflow: window.getComputedStyle(body).overflow,
        bodyScrollable: body.scrollHeight > body.clientHeight,
        containerFitsHeight: container ? container.scrollHeight <= container.clientHeight : false,
        headerHeight: header ? header.offsetHeight : 0,
        containerTop: container ? container.offsetTop : 0,
        containerHeight: container ? container.offsetHeight : 0,
        layout: {
          sidebarWidth: sidebar ? sidebar.offsetWidth : 0,
          sidebarHeight: sidebar ? sidebar.offsetHeight : 0,
          mainWidth: mainContent ? mainContent.offsetWidth : 0,
          mainHeight: mainContent ? mainContent.offsetHeight : 0,
          propertiesWidth: properties ? properties.offsetWidth : 0,
          propertiesHeight: properties ? properties.offsetHeight : 0,
          totalWidth: (sidebar?.offsetWidth || 0) + (mainContent?.offsetWidth || 0) + (properties?.offsetWidth || 0)
        },
        canvasVisible: {
          exists: !!document.querySelector('.form-canvas'),
          height: document.querySelector('.form-canvas')?.offsetHeight || 0,
          needsScroll: document.querySelector('.form-canvas') ? 
            document.querySelector('.form-canvas').scrollHeight > document.querySelector('.form-canvas').clientHeight : false
        },
        allElementsVisible: {
          sidebar: sidebar && sidebar.offsetHeight > 0 && sidebar.offsetWidth > 0,
          mainContent: mainContent && mainContent.offsetHeight > 0 && mainContent.offsetWidth > 0,
          properties: properties && properties.offsetHeight > 0 && properties.offsetWidth > 0,
          header: header && header.offsetHeight > 0
        }
      };
    });
    
    console.log('Layout test results:', JSON.stringify(layoutTest, null, 2));
    
    // Test scrolling behavior
    const scrollTest = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar-content');
      const properties = document.getElementById('propertyContent');
      const canvas = document.querySelector('.form-canvas');
      
      return {
        sidebarScrollable: sidebar ? sidebar.scrollHeight > sidebar.clientHeight : false,
        sidebarScrollHeight: sidebar ? sidebar.scrollHeight : 0,
        sidebarClientHeight: sidebar ? sidebar.clientHeight : 0,
        propertiesScrollable: properties ? properties.scrollHeight > properties.clientHeight : false,
        canvasScrollable: canvas ? canvas.scrollHeight > canvas.clientHeight : false,
        pageScrollable: document.body.scrollHeight > document.body.clientHeight || 
                       document.documentElement.scrollHeight > document.documentElement.clientHeight
      };
    });
    
    console.log('Scroll test results:', JSON.stringify(scrollTest, null, 2));
    
    // Test field palette visibility
    const fieldTest = await page.evaluate(() => {
      const fieldBlocks = document.querySelectorAll('.field-block');
      const visibleFields = Array.from(fieldBlocks).filter(block => {
        const rect = block.getBoundingClientRect();
        const style = window.getComputedStyle(block);
        return rect.height > 0 && rect.width > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      });
      
      return {
        totalFields: fieldBlocks.length,
        visibleFields: visibleFields.length,
        fieldDimensions: visibleFields.slice(0, 3).map(field => ({
          width: field.offsetWidth,
          height: field.offsetHeight
        }))
      };
    });
    
    console.log('Field palette test:', JSON.stringify(fieldTest, null, 2));
    
    // Test smaller laptop screen
    console.log('\nTesting on smaller laptop screen (1366x768)...');
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(1000);
    
    const smallerScreenTest = await page.evaluate(() => {
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        showsLanding: document.getElementById('mobileLandingPage')?.style.display === 'flex',
        showsDesktop: document.getElementById('desktopApplication')?.style.display !== 'none'
      };
    });
    
    console.log('Smaller screen test:', JSON.stringify(smallerScreenTest, null, 2));
    
    if (smallerScreenTest.showsDesktop) {
      await page.screenshot({ path: 'ultra-compact-1366.png', fullPage: false });
      console.log('Smaller screen screenshot saved');
    }
    
  } catch (error) {
    console.error('Error testing ultra-compact layout:', error);
  }
  
  await browser.close();
})();