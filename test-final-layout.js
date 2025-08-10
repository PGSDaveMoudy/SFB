const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Testing final responsive layout...');
    
    // Test 1: Large desktop (should show 3 columns)
    console.log('\n=== Test 1: Large Desktop (1920x1080) ===');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('https://pilotforms.com', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    const largeDesktopTest = await page.evaluate(() => {
      return {
        windowSize: { width: window.innerWidth, height: window.innerHeight },
        mobilePageDisplay: document.getElementById('mobileLandingPage')?.style.display || 'none',
        desktopAppDisplay: document.getElementById('desktopApplication')?.style.display || 'none',
        sidebarVisible: !!document.querySelector('.sidebar') && window.getComputedStyle(document.querySelector('.sidebar')).display !== 'none',
        canvasVisible: !!document.querySelector('.form-canvas'),
        propertiesVisible: !!document.querySelector('.properties-panel') && window.getComputedStyle(document.querySelector('.properties-panel')).display !== 'none',
        containerFlex: window.getComputedStyle(document.querySelector('.container')).display,
        sidebarWidth: document.querySelector('.sidebar')?.offsetWidth || 0,
        propertiesWidth: document.querySelector('.properties-panel')?.offsetWidth || 0,
        mainContentWidth: document.querySelector('.main-content')?.offsetWidth || 0
      };
    });
    
    console.log('Large desktop results:', JSON.stringify(largeDesktopTest, null, 2));
    await page.screenshot({ path: 'test-large-desktop.png' });
    
    // Test 2: Medium screen that should show landing page (1300px)
    console.log('\n=== Test 2: Medium Screen (1300x800) - Should show landing page ===');
    await page.setViewportSize({ width: 1300, height: 800 });
    await page.waitForTimeout(1000);
    
    const mediumScreenTest = await page.evaluate(() => {
      return {
        windowSize: { width: window.innerWidth, height: window.innerHeight },
        mobilePageDisplay: document.getElementById('mobileLandingPage')?.style.display || 'none',
        desktopAppDisplay: document.getElementById('desktopApplication')?.style.display || 'none',
        landingPageVisible: document.getElementById('mobileLandingPage') && window.getComputedStyle(document.getElementById('mobileLandingPage')).display === 'flex'
      };
    });
    
    console.log('Medium screen results:', JSON.stringify(mediumScreenTest, null, 2));
    await page.screenshot({ path: 'test-medium-screen.png' });
    
    // Test 3: Just above threshold (1450px)
    console.log('\n=== Test 3: Just Above Threshold (1450x900) ===');
    await page.setViewportSize({ width: 1450, height: 900 });
    await page.waitForTimeout(1000);
    
    const justAboveTest = await page.evaluate(() => {
      return {
        windowSize: { width: window.innerWidth, height: window.innerHeight },
        mobilePageDisplay: document.getElementById('mobileLandingPage')?.style.display || 'none',
        desktopAppDisplay: document.getElementById('desktopApplication')?.style.display || 'none',
        allThreeColumnsVisible: {
          sidebar: !!document.querySelector('.sidebar') && window.getComputedStyle(document.querySelector('.sidebar')).display !== 'none',
          canvas: !!document.querySelector('.main-content'),
          properties: !!document.querySelector('.properties-panel') && window.getComputedStyle(document.querySelector('.properties-panel')).display !== 'none'
        },
        columnsLayout: {
          sidebarWidth: document.querySelector('.sidebar')?.offsetWidth || 0,
          mainWidth: document.querySelector('.main-content')?.offsetWidth || 0,
          propertiesWidth: document.querySelector('.properties-panel')?.offsetWidth || 0,
          totalUsed: (document.querySelector('.sidebar')?.offsetWidth || 0) + 
                     (document.querySelector('.main-content')?.offsetWidth || 0) + 
                     (document.querySelector('.properties-panel')?.offsetWidth || 0)
        }
      };
    });
    
    console.log('Just above threshold results:', JSON.stringify(justAboveTest, null, 2));
    await page.screenshot({ path: 'test-just-above-threshold.png' });
    
    // Test 4: Mobile (375px)
    console.log('\n=== Test 4: Mobile (375x667) ===');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    const mobileTest = await page.evaluate(() => {
      return {
        windowSize: { width: window.innerWidth, height: window.innerHeight },
        mobilePageDisplay: document.getElementById('mobileLandingPage')?.style.display || 'none',
        desktopAppDisplay: document.getElementById('desktopApplication')?.style.display || 'none',
        landingPageVisible: document.getElementById('mobileLandingPage') && window.getComputedStyle(document.getElementById('mobileLandingPage')).display === 'flex',
        landingPageMessage: document.querySelector('.mobile-landing-message h2')?.textContent || 'No message found'
      };
    });
    
    console.log('Mobile results:', JSON.stringify(mobileTest, null, 2));
    await page.screenshot({ path: 'test-mobile.png' });
    
  } catch (error) {
    console.error('Error testing layout:', error);
  }
  
  await browser.close();
})();