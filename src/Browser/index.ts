/*
import puppeteer from 'puppeteer-extra';
import { executablePath } from 'puppeteer';
import * as log from '../Log';

// This plugin prevent bot detection
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// This plugin anonymize user agent
import AnonymizeUA from 'puppeteer-extra-plugin-anonymize-ua';
// This plugin use adblocker (bc imleague was bloated with ads!!!!)
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker';

import type { AuthPayload } from '../Interfaces/Auth';
import { z } from 'zod';

puppeteer.use(AdblockerPlugin({ blockTrackers: true }));
puppeteer.use(StealthPlugin());
puppeteer.use(AnonymizeUA());
*/

export const getCaptchaToken = async (): Promise<string> => {
    // TODO: for some reason this work ?????????
    // TODO: if they fix the captcha thing, remove comments
    return 'abc';
    
    /*
    try {
        // Launch brower instance
        const browser = await puppeteer.launch({
            headless: process.env.HEADLESS?.toLowerCase() == 'false' ? false : 'shell',
            slowMo: 10,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            executablePath: executablePath(),
            timeout: 0,
        });

        const [page] = await browser.pages();
        await page.goto('https://public.txdpsscheduler.com/');

        // English button
        await page.waitForSelector('.container > button');
        await page.click('.container > button');

        await page.waitForNetworkIdle();

        // Personal infomation form
        await page.waitForSelector('.v-card__text');

        await page.evaluate(() => {
            const vcardText = document.querySelector('.v-card__text');
            if (vcardText) {
                const inputs = document.querySelectorAll('.v-input');
                if (inputs.length >= 4) {
                    for (let i = 1; i < 5; i++) {
                        const input = inputs[i].querySelector('input') as HTMLInputElement;
                        switch (i) {
                            // First name and last name
                            case 1:
                            case 2:
                                input.value = 'test';
                                break;
                            // Date of birth
                            case 3:
                                input.value = '01/01/2001';
                                break;
                            // Last 4 digits of SSN
                            case 4:
                                input.value = '1111';
                                break;
                        }
                        // Dispatch an input event to trigger any listeners
                        const event = new Event('input', { bubbles: true });
                        input.dispatchEvent(event);
                    }
                }
            }
        });

        await page.setRequestInterception(true);
        log.dev('Request interception enabled');

        const captchaTokenPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Auth token retrieval timed out after 60 seconds')), 60000);
            // Listen for network requests
            page.on('request', request => {
                log.dev(`Request intercepted: ${request.url()}`);
                if (request.url() === 'https://apptapi.txdpsscheduler.com/api/auth' && request.method() == 'POST') {
                    const postData = JSON.parse(request.postData()) as AuthPayload;
                    clearTimeout(timeout);
                    resolve(postData.RecaptchaToken.Token);
                }
                request.continue();
            });

            // Click the login button
            page.waitForSelector('.v-card__actions > button').then(() => page.click('.v-card__actions > button'));
        });

        // Wait for the auth token
        const captchaToken = (await captchaTokenPromise) as string;

        // Close the browser
        await browser.close();

        log.info('Get captcha token successfully!');
        log.dev(`Captcha token: ${captchaToken}`);
        return captchaToken;
    } catch (err) {
        log.error('Error while getting captcha token: ', err as Error);
        log.info('Try to get captcha token again or manual set it in config.yml');
        process.exit(1);
    }
    */
};

if (process.env.NODE_ENV === 'development') getCaptchaToken();
