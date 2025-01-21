import _ from 'lodash';
import puppeteer from 'puppeteer-extra';
import { executablePath, Page } from 'puppeteer';
// This plugin prevent bot detection
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
// This plugin anonymize user agent
import AnonymizeUA from 'puppeteer-extra-plugin-anonymize-ua';

import * as log from '../Log';
import parseConfig from '../Config';
import nodeTimer from 'node:timers/promises';

puppeteer.use(StealthPlugin());
puppeteer.use(AnonymizeUA({ stripHeadless: true, makeWindows: true }));

export const getAuthTokenFromBroswer = async (): Promise<string> => {
    const config = parseConfig();
    try {
        // Launch brower instance
        const browser = await puppeteer.launch({
            headless: process.env.HEADLESS?.toLowerCase() == 'false' ? false : 'shell',
            slowMo: 10,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disk-cache-size=0'],
            browser: 'chrome',
            executablePath: executablePath(),
            timeout: 0,
        });
        const [page] = await browser.pages();

        // Randomize viewport size
        await page.setViewport({
            width: 1920 + _.random(0, 200),
            height: 1080 + _.random(0, 200),
            deviceScaleFactor: 1,
            hasTouch: false,
            isLandscape: false,
            isMobile: false,
        });
        await page.setJavaScriptEnabled(true);
        await page.setDefaultNavigationTimeout(0);
        await page.goto('https://www.txdpsscheduler.com/');

        // English button
        await page.waitForSelector('.container > button');
        await page.click('.container > button');

        await page.waitForNetworkIdle();

        // switch to espanol
        await page.waitForSelector('.v-toolbar__content button:nth-child(2)');
        await page.click('.v-toolbar__content button:nth-child(2)');

        // Personal infomation form
        await page.waitForSelector('.v-card__text');

        await nodeTimer.setTimeout(_.random(500, 1500)); // Random delay between 500ms and 1500ms

        log.dev('inputting personal info..');
        await page.type('.v-input:nth-child(2) input', config.personalInfo.firstName, { delay: _.random(200, 600) });
        await page.type('.v-input:nth-child(3) input', config.personalInfo.lastName, { delay: _.random(200, 600) });
        await page.type('.v-input:nth-child(4) input', config.personalInfo.dob.replaceAll('/', ''), { delay: _.random(200, 600) });
        await page.type('.v-input:nth-child(5) input', config.personalInfo.lastFourSSN, { delay: _.random(200, 600) });

        log.dev('input personal info done');

        log.dev('Scrolling..');
        await page.evaluate(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, scrollHeight - Math.random() * 400);
        });

        await page.setRequestInterception(true);
        log.dev('Request interception enabled');

        const captchaTokenPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Auth token retrieval timed out after 60 seconds')), 60000);
            // Listen for network requests
            page.on('request', request => {
                if (request.resourceType() == 'stylesheet' || request.resourceType() == 'font' || request.resourceType() == 'image') {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            page.on('response', response => {
                log.dev(`Response intercepted: ${response.url()}`);
                if (response.url() === 'https://apptapi.txdpsscheduler.com/api/auth' && response.status() == 200) {
                    clearTimeout(timeout);
                    resolve(response.text());
                }
            });

            // Click the login button
            page.waitForSelector('.v-card__actions.text-center > button').then(async () => {
                await page.click('.v-card__actions.text-center > button');
                page.waitForSelector('.v-dialog--active')
                    .then(() => setTimeout(() => tryAgainDialog(page), 5000))
                    .catch(() => null);
            });
        });

        const tryAgainDialog = async (page: Page, retryTime = 0) => {
            log.dev('google catpcha score too low, trying again!');
            if (retryTime > 10) throw new Error('Captcha token retrieval failled!');
            nodeTimer.setTimeout(_.random(1000, 3000, false));
            await page.click('.v-dialog--active > div > div > button');
            nodeTimer.setTimeout(_.random(1000, 3000, false));
            await page.click('.v-card__actions.text-center > button');
            page.waitForSelector('.v-dialog--active')
                .then(() => setTimeout(() => tryAgainDialog(page, retryTime + 1), 5000))
                .catch(() => null);
        };

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
};
