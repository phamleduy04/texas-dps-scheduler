import _ from 'lodash';
import puppeteer from 'puppeteer-extra';
import { Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AnonymizeUA from 'puppeteer-extra-plugin-anonymize-ua';
import { createCursor } from 'ghost-cursor'; // Add this package for realistic mouse movements

import * as log from '../Log';
import parseConfig from '../Config';
import nodeTimer from 'node:timers/promises';

// Configure stealth plugin with more options
const stealth = StealthPlugin();
// Enable all evasions
puppeteer.use(stealth);
puppeteer.use(AnonymizeUA({ 
  stripHeadless: true, 
  makeWindows: true,
  customFn: (ua) => ua.replace(/Chrome\/[\d.]+/, `Chrome/${_.random(100, 112)}.0.${_.random(1000, 5000)}.${_.random(10, 99)}`)
}));

// Function for human-like typing
const humanType = async (page, selector, text) => {
  await page.focus(selector);
  
  // Type with variable delays between keystrokes
  for (let i = 0; i < text.length; i++) {
    // Occasional pause during typing (as if thinking)
    if (i > 0 && i % 3 === 0 && Math.random() > 0.7) {
      await nodeTimer.setTimeout(_.random(300, 1200));
    }
    
    await page.keyboard.press(text[i]);
    await nodeTimer.setTimeout(_.random(30, 200));
  }
}

export const getAuthTokenFromBroswer = async (): Promise<string> => {
    const config = parseConfig();
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {

            const browser = await puppeteer.launch({
                headless: true,
                executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                userDataDir: './user_profile', // <--- this persists your browser profile
                slowMo: _.random(10, 30),
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-accelerated-2d-canvas',
                    '--disable-dev-shm-usage',
                    `--window-size=${1200 + _.random(100, 300)},${800 + _.random(100, 200)}`,
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--lang=en-US,en;q=0.9'
                ],
                ignoreDefaultArgs: ['--enable-automation'], // 👈 THIS is the key!
                timeout: 60000,
              });
            
            const [page] = await browser.pages();
            const cursor = createCursor(page);
            
            // Human-like fingerprint
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [
                        { name: 'Chrome PDF Plugin' },
                        { name: 'Chrome PDF Viewer' },
                        { name: 'Native Client' }
                    ]
                });
                Object.defineProperty(screen, 'width', { value: 1280 + Math.floor(Math.random() * 200) });
                Object.defineProperty(screen, 'height', { value: 800 + Math.floor(Math.random() * 200) });
            });
            
            await page.setViewport({
                width: 1280 + _.random(0, 200),
                height: 800 + _.random(0, 200),
                deviceScaleFactor: 1,
                hasTouch: false,
                isLandscape: true,
                isMobile: false,
            });
            
            await page.setJavaScriptEnabled(true);
            await page.setDefaultNavigationTimeout(90000);
            
            log.dev('🔁 Warming up browser...');
            await page.goto('https://news.ycombinator.com/', { waitUntil: 'domcontentloaded' });
            await nodeTimer.setTimeout(_.random(5000, 9000));
            
            await page.goto('https://www.google.com/search?q=texas+dmv+appointments', { waitUntil: 'domcontentloaded' });
            await nodeTimer.setTimeout(_.random(5000, 9000));
            
            log.dev('🌐 Navigating to Texas DPS Scheduler...');
            await page.goto('https://www.txdpsscheduler.com/', {
                waitUntil: 'networkidle2',
                timeout: 60000
            });
            
            await nodeTimer.setTimeout(_.random(2000, 4000)); // pause before starting interaction
            
            
            // Move cursor and click English button
            log.dev('Selecting language...');
            const languageButton = await page.$('.container > button');
            if (languageButton) {
            await cursor.move(languageButton);
            await nodeTimer.setTimeout(_.random(500, 1200));
            await cursor.click();
            } else {
            log.warn('⚠️ Language selection button not found');
            }
            
            await page.waitForNetworkIdle({ idleTime: 1000 })
                .catch(() => log.dev('Network idle timeout, continuing anyway'));
            
            // Random delay before next action
            await nodeTimer.setTimeout(_.random(100, 300));
            
            // Move cursor and switch to español with natural movement
            log.dev('Switching language...');
            const langSwitch = await page.$('.v-toolbar__content button:nth-child(2)');
            if (langSwitch) {
                await cursor.move(langSwitch);
                await nodeTimer.setTimeout(_.random(300, 800));
                await cursor.click();
            } else {
                log.warn('⚠️ Language switch button not found');
            }
            await nodeTimer.setTimeout(_.random(300, 800));
            await cursor.click();
            
            // Wait for form to load
            await page.waitForSelector('.v-card__text', { visible: true });
            
            // Realistic pause before filling form
            await nodeTimer.setTimeout(_.random(500, 700));
            
            log.dev('Filling personal information...');
            
            // Fill form with human-like typing and pauses between fields
            await humanType(page, '.v-input:nth-child(2) input', config.personalInfo.firstName);
            await nodeTimer.setTimeout(_.random(800, 1600));
            
            await humanType(page, '.v-input:nth-child(3) input', config.personalInfo.lastName);
            await nodeTimer.setTimeout(_.random(700, 1500));
            
            await humanType(page, '.v-input:nth-child(4) input', config.personalInfo.dob.replaceAll('/', ''));
            await nodeTimer.setTimeout(_.random(1000, 2000));
            
            await humanType(page, '.v-input:nth-child(5) input', config.personalInfo.lastFourSSN);
            
            log.dev('Form completed, now scrolling...');
            
            // Natural scrolling behavior
            await page.evaluate(() => {
                const scrollHeight = document.body.scrollHeight;
                const viewportHeight = window.innerHeight;
                const scrollTarget = scrollHeight - viewportHeight;
                
                // Scroll in small chunks with variable speed
                return new Promise(resolve => {
                    let scrolled = 0;
                    const scrollInterval = setInterval(() => {
                        const step = Math.floor(Math.random() * 100) + 20;
                        
                        // Add "human" jitter to scrolling
                        const jitter = Math.random() > 0.7 ? Math.random() * 20 - 10 : 0;
                        
                        window.scrollBy(0, step + jitter);
                        scrolled += step;
                        
                        // Occasionally pause scrolling briefly
                        if (Math.random() > 0.8) {
                            clearInterval(scrollInterval);
                            setTimeout(() => {
                                const newInterval = setInterval(() => {
                                    const newStep = Math.floor(Math.random() * 100) + 20;
                                    window.scrollBy(0, newStep);
                                    scrolled += newStep;
                                    
                                    if (scrolled >= scrollTarget) {
                                        clearInterval(newInterval);
                                        resolve(true);
                                    }
                                }, Math.random() * 50 + 30);
                            }, Math.random() * 500 + 200);
                        }
                        
                        if (scrolled >= scrollTarget) {
                            clearInterval(scrollInterval);
                            resolve(true);
                        }
                    }, Math.random() * 50 + 30);
                });
            });
            
            // Random pause after scrolling
            await nodeTimer.setTimeout(_.random(1500, 3000));
            
            // Set up network request interception more selectively
            await page.setRequestInterception(true);
            log.dev('Request interception enabled');
            
            // Create a more robust promise for the token
            const captchaTokenPromise = new Promise((resolve, reject) => {
                const timeoutDuration = 60000; // 2 minutes
                const timeout = setTimeout(() => {
                    reject(new Error(`Auth token retrieval timed out after ${timeoutDuration/1000} seconds`));
                }, timeoutDuration);
                
                // Filter requests
                page.on('request', request => {
                    const resourceType = request.resourceType();
                    const url = request.url();
                    
                    // Only block unnecessary resources but keep CAPTCHA-related ones
                    if (
                        (resourceType === 'image' && !url.includes('captcha') && !url.includes('recaptcha')) || 
                        (resourceType === 'font') || 
                        (resourceType === 'media') ||
                        url.includes('analytics') ||
                        url.includes('tracking')
                    ) {
                        request.abort();
                    } else {
                        request.continue();
                    }
                });
                
                // Monitor responses for the auth token
                page.on('response', async response => {
                    const url = response.url();
                    const status = response.status();
                    
                    if (url === 'https://apptapi.txdpsscheduler.com/api/auth' && status === 200) {
                        clearTimeout(timeout);
                        try {
                            const responseText = await response.text();
                            resolve(responseText);
                        } catch (err) {
                            log.error('Error extracting response text:', err);
                            reject(err);
                        }
                    }
                });
                
                // Click login button with human behavior
                page.waitForSelector('.v-card__actions.text-center > button', { visible: true })
                    .then(async () => {
                        // Move cursor to button with natural movement
                        const loginButton = await page.$('.v-card__actions.text-center > button');
                        if (loginButton) {
                            await cursor.move(loginButton);
                            await nodeTimer.setTimeout(_.random(800, 1800));
                            await cursor.click();
                        } else {
                            log.error('❌ Login button not found');
                            reject(new Error('Login button not found'));
                        }
                        
                        // Check for CAPTCHA dialog and handle it
                        try {
                            await page.waitForSelector('.v-dialog--active', { timeout: 20000 });
                            log.dev('CAPTCHA dialog detected, will retry');
                            // Wait before attempting to retry
                            setTimeout(() => tryAgainDialog(page, cursor), _.random(5000, 8000));
                        } catch (e) {
                            log.dev('No dialog appeared, CAPTCHA might have passed' + e);
                        }
                    })
                    .catch(e => {
                        log.error('Failed to find login button:', e);
                        reject(e);
                    });
            });
            
            // Improved CAPTCHA retry dialog handling
            const tryAgainDialog = async (page: Page, cursor: any, retryTime = 0) => {
                log.dev(`CAPTCHA score too low, trying again (attempt ${retryTime + 1})`);
                
                if (retryTime >= 5) {
                    throw new Error('CAPTCHA token retrieval failed after multiple attempts');
                }
                
                // Progressive waiting period between retries
                await nodeTimer.setTimeout(_.random(3000, 6000));
                
                try {
                    // Move mouse around a bit before clicking
                    await cursor.move({ x: _.random(100, 500), y: _.random(100, 400) });
                    await nodeTimer.setTimeout(_.random(500, 1000));
                    
                    // Click the "try again" button
                    const retryButton = await page.$('.v-dialog--active > div > div > button');
                    if (retryButton) {
                        await cursor.move(retryButton);
                        await nodeTimer.setTimeout(_.random(400, 900));
                        await cursor.click();
                    } else {
                        log.warn('⚠️ Retry button not found during CAPTCHA retry');
                        return;
                    }
                    
                    // Wait between actions
                    await nodeTimer.setTimeout(_.random(2000, 4000));
                    
                    // Move cursor around randomly (this helps with CAPTCHA)
                    for (let i = 0; i < _.random(2, 5); i++) {
                        await cursor.move({ x: _.random(100, 800), y: _.random(100, 600) });
                        await nodeTimer.setTimeout(_.random(300, 800));
                    }
                    
                    // Click login button again
                    const retryLoginButton = await page.$('.v-card__actions.text-center > button');
                    if (retryLoginButton) {
                        await cursor.move(retryLoginButton);
                        await nodeTimer.setTimeout(_.random(500, 1200));
                        await cursor.click();
                    } else {
                        log.warn('⚠️ Login button not found during retry');
                        return;
                    }

                    
                    // Check for dialog again
                    try {
                        await page.waitForSelector('.v-dialog--active', { timeout: 15000 });
                        // Dialog appeared, need to retry
                        setTimeout(() => tryAgainDialog(page, cursor, retryTime + 1), _.random(6000, 10000));
                    } catch (e) {
                        log.dev('No dialog after retry, CAPTCHA might have passed' + e);
                    }
                } catch (error) {
                    log.error(`Error during CAPTCHA retry:`, error);
                    if (retryTime < 4) {
                        setTimeout(() => tryAgainDialog(page, cursor, retryTime + 1), 8000);
                    } else {
                        throw new Error('CAPTCHA retry mechanism failed');
                    }
                }
            };
            
            try {
                const captchaToken = await captchaTokenPromise as string;
                
                // Success! Close browser gracefully
                await nodeTimer.setTimeout(_.random(1000, 2000));
                await browser.close();
                
                log.info('Authentication successful!');
                log.dev(`Auth token: ${captchaToken}`);
                return captchaToken;
            } catch (tokenError) {
                log.error(`Token retrieval error: ${tokenError.message}`);
                await browser.close();
                
                retryCount++;
                if (retryCount < maxRetries) {
                    const waitTime = 15000 * retryCount; // Progressive backoff
                    log.info(`Retrying authentication (attempt ${retryCount + 1}/${maxRetries}) after ${waitTime/1000} seconds...`);
                    await nodeTimer.setTimeout(waitTime);
                } else {
                    throw new Error(`Failed to get authentication token after ${maxRetries} attempts`);
                }
            }
        } catch (err) {
            log.error(`Browser automation error:`, err as Error);
            retryCount++;
            
            if (retryCount < maxRetries) {
                const waitTime = 20000 * retryCount;
                log.info(`Retrying browser automation after ${waitTime/1000} seconds...`);
                await nodeTimer.setTimeout(waitTime);
            } else {
                log.info('Try manually setting the token in config.yml');
                process.exit(1);
            }
        }
    }
    
    throw new Error('Failed to get authentication token');
};
