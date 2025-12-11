import _ from 'lodash';
import { chromium, Page } from 'patchright';

import * as log from '../Log';
import parseConfig from '../Config';
import nodeTimer from 'node:timers/promises';
import os from 'node:os';

export const getAuthTokenFromBroswer = async (): Promise<string> => {
    const config = parseConfig();
    try {
        // Launch brower instance
        const browser = await chromium.launch({
            channel: os.arch() === 'arm64' ? 'chromium' : 'chrome',
            headless: false,
        });
        const page = await browser.newPage();

        await page.goto('https://www.dps.texas.gov/section/driver-license/driver-license-services-appointments');

        await page.waitForSelector('.btn-primary');
        await page.click('.btn-primary');

        // English button
        await page.waitForSelector('.container > button');
        await page.click('.container > button');

        // switch to espanol
        await page.waitForSelector('.v-toolbar__content button:nth-child(2)');
        await page.click('.v-toolbar__content button:nth-child(2)');

        // Personal infomation form
        await page.waitForSelector('.v-card__text');

        await nodeTimer.setTimeout(_.random(500, 1500)); // Random delay between 500ms and 1500ms

        log.info('Inputting personal info...');
        const firstNameInput = await page.locator('.v-input:nth-child(2) input');
        await firstNameInput.pressSequentially(config.personalInfo.firstName, { delay: _.random(200, 600) });
        const lastNameInput = await page.locator('.v-input:nth-child(3) input');
        await lastNameInput.pressSequentially(config.personalInfo.lastName, { delay: _.random(200, 600) });
        const dobInput = await page.locator('.v-input:nth-child(4) input');
        await dobInput.pressSequentially(config.personalInfo.dob.replaceAll('/', ''), { delay: _.random(200, 600) });
        const lastFourSSNInput = await page.locator('.v-input:nth-child(5) input');
        await lastFourSSNInput.pressSequentially(config.personalInfo.lastFourSSN, { delay: _.random(200, 600) });
        const radioGroup = await page.locator('.v-input--radio-group');
        await radioGroup.locator('label').nth(1).click();

        const emailInput = await page.locator('input[id="email"]');
        await emailInput.pressSequentially(config.personalInfo.email, { delay: _.random(200, 600) });
        const verifyEmailInput = await page.locator('input[id="verifyEmail"]');
        await verifyEmailInput.pressSequentially(config.personalInfo.email, { delay: _.random(200, 600) });

        log.info('Input personal info done');

        const captchaTokenPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Auth token retrieval timed out after 60 seconds')), 60000);

            page.on('response', async response => {
                if (response.url() === 'https://apptapi.txdpsscheduler.com/api/v1/account/auth' && response.status() === 200) {
                    const body = await response.json();
                    clearTimeout(timeout);
                    resolve(body);
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
            log.info('Google reCaptcha score too low, trying again!');
            if (retryTime > 10) throw new Error('Captcha token retrieval failled!');
            await nodeTimer.setTimeout(_.random(1000, 3000, false));
            await page.click('.v-dialog--active > div > div > button');
            await nodeTimer.setTimeout(_.random(1000, 3000, false));
            await page.click('.v-card__actions.text-center > button');
            page.waitForSelector('.v-dialog--active')
                .then(() => setTimeout(() => tryAgainDialog(page, retryTime + 1), 5000))
                .catch(() => null);
        };

        // Wait for the auth token
        const captchaToken = (await captchaTokenPromise) as { data: { token: string; eligibleCard: string } };

        await page.close();
        // Close the browser
        await browser.close();

        log.info('Get captcha token successfully!');
        // REDACTED: log.dev(`Captcha token: ${captchaToken.data.token}`);
        return captchaToken.data.token;
    } catch (err) {
        log.error('Error while getting captcha token: ', err as Error);
        log.info('Try to get captcha token again or manual set it in config.yml');
        process.exit(1);
    }
};
