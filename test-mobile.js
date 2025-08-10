const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Testing mobile experience on pilotforms.com...');
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('https://pilotforms.com', { waitUntil: 'networkidle' });
    
    // Wait a moment for the mobile detection script to run
    await page.waitForTimeout(1000);
    
    // Take a screenshot
    await page.screenshot({ path: 'mobile-experience.png', fullPage: true });
    console.log('Mobile screenshot saved as mobile-experience.png');
    
    // Check if mobile landing page is visible
    const mobilePageVisible = await page.evaluate(() => {
      const mobileApp = document.getElementById('mobileLandingPage');
      const desktopApp = document.getElementById('desktopApplication');
      return {
        mobileDisplay: window.getComputedStyle(mobileApp).display,
        desktopDisplay: window.getComputedStyle(desktopApp).display,
        windowWidth: window.innerWidth
      };
    });
    
    console.log('Mobile page visibility:', mobilePageVisible);
    
    // Check for mobile landing page content
    const mobileContent = await page.evaluate(() => {
      const content = document.querySelector('.mobile-landing-content');
      if (content) {
        return {
          title: content.querySelector('h1')?.textContent || 'No title found',
          message: content.querySelector('.mobile-landing-message h2')?.textContent || 'No message found'
        };
      }
      return null;
    });
    
    console.log('Mobile landing page content:', mobileContent);
    
  } catch (error) {
    console.error('Error testing mobile site:', error);
  }
  
  await browser.close();
})();