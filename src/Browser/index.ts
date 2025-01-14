import _ from 'lodash';
import { fakerEN_US as faker } from '@faker-js/faker';

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
            defaultViewport: { width:1920, height:1080 },
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disk-cache-size=0'],
            browser: 'chrome',
            executablePath: executablePath(),
            timeout: 0,
        });

        const [page] = await browser.pages();
        await page.goto('https://public.txdpsscheduler.com/');

        // English button
        await page.waitForSelector('.container > button');
        await page.click('.container > button');

        await page.waitForNetworkIdle();

        // switch to espanol
        await page.waitForSelector('.v-toolbar__content button:nth-child(2)');
        await page.click('.v-toolbar__content button:nth-child(2)');

        // Personal infomation form
        await page.waitForSelector('.v-card__text');

        log.info('Scrolling..');
        // random scroll
        const scrollAmount = _.random(-500, 500); // Random scroll between -500 and 500 pixels
        await page.evaluate(amount => window.scrollBy(0, amount), scrollAmount);

        await nodeTimer.setTimeout(Math.random() * 3000 + 500); // Random delay between 500ms and 1500ms

        log.dev('inputting personal info..');
        await page.type('.v-input:nth-child(2) input', faker.person.firstName(), { delay: _.random(200, 600) });
        await page.type('.v-input:nth-child(3) input', faker.person.lastName(), { delay: _.random(200, 600) });
        await page.type('.v-input:nth-child(4) input', config.personalInfo.dob.replaceAll('/', ''), { delay: _.random(200, 600) });
        await page.type('.v-input:nth-child(5) input', faker.string.numeric({ length: 4 }), { delay: _.random(200, 600) });

        log.dev('input personal info done');

        await page.setRequestInterception(true);
        log.dev('Request interception enabled');

        const captchaTokenPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Auth token retrieval timed out after 60 seconds')), 60000);
            // Listen for network requests
            page.on('request', request => request.continue());

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
            await page.click('.v-dialog--active > div > div > button');
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
