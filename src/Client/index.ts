import https from 'https';
import axios, { AxiosResponse } from 'axios';
import sleep from 'timers/promises';
import parseConfig from '../Config';
import * as log from '../Log';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { getAuthTokenFromBroswer } from '../Browser';
import { CreateCaptchaSolverTask, GetCaptchaSolverResult } from '../CaptchaSolver';
dayjs.extend(isBetween);
import prompts from 'prompts';
import type { EligibilityPayload } from '../Interfaces/Eligibility';
import type { AvailableLocationPayload, AvailableLocationResponse } from '../Interfaces/AvailableLocation';
import type { AvailableLocationDatesPayload, AvailableLocationDatesResponse, AvailableTimeSlots } from '../Interfaces/AvailableLocationDates';
import type { HoldSlotPayload, HoldSlotResponse } from '../Interfaces/HoldSlot';
import type { BookSlotPayload, BookSlotResponse } from '../Interfaces/BookSlot';
import type { ExistBookingPayload, ExistBookingResponse } from '../Interfaces/ExistBooking';
import type { CancelBookingPayload } from '../Interfaces/CancelBooking';
import type { AuthPayload } from '../Interfaces/Auth';
import { pushNotifcation } from '../PushNotification';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import PQueue from 'p-queue';

let packagejson;
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    packagejson = require('../../package.json');
} catch {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        packagejson = require('../package.json');
    } catch {
        packagejson.version = null;
    }
}

class TexasScheduler {
    private readonly requestClient = axios.create({
        baseURL: 'https://apptapi.txdpsscheduler.com',
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
    public config = parseConfig();
    public existBooking: { exist: boolean; response: ExistBookingResponse[] } | undefined;

    private availableLocation: AvailableLocationResponse[] | null = null;
    private isBooked = false;
    private isHolded = false;
    private queue = new PQueue({ concurrency: 1 });
    private authToken = '';
    private readonly maxCaptchaSolverRetries = 25;
    private responseId: number | null = null;

    public constructor() {
        if (this.config.appSettings.webserver)
            // eslint-disable-next-line  @typescript-eslint/no-require-imports
            require('http')
                .createServer((req: any, res: any) => res.end('Bot is alive!'))
                .listen(process.env.PORT || 3000);
        log.info(`Texas Scheduler v${packagejson.version} is starting...`);
        log.info('Requesting Available Location....');
        if (!existsSync('cache')) mkdirSync('cache');
        this.run();
    }

    public async run() {
        if (existsSync('././cache/token.tmp')) {
            log.info('Getting auth token from cache...');
            this.authToken = readFileSync('././cache/token.tmp', 'utf-8');
        } else await this.getAuthToken();
        if (this.responseId === null) await this.getResponseId();
        this.existBooking = await this.checkExistBooking();
        const { exist, response } = this.existBooking;
        if (exist) {
            log.warn(`You have an existing booking at ${response[0].SiteName} ${dayjs(response[0].BookingDateTime).format('MM/DD/YYYY hh:mm A')}`);
            if (!this.config.appSettings.cancelIfExist) {
                log.warn(`The bot will continue to run, but WILL NOT cancel existing booking if it found a new one`);
            }
            else {
                log.warn(`The bot will continue to run, but will cancel existing booking if it found a new one`);
            }

        }
        await this.requestAvailableLocation();
        await this.getLocationDatesAll();
    }

    private async checkExistBooking() {
        const requestBody: ExistBookingPayload = {
            FirstName: this.config.personalInfo.firstName,
            LastName: this.config.personalInfo.lastName,
            DateOfBirth: this.config.personalInfo.dob,
            LastFourDigitsSsn: this.config.personalInfo.lastFourSSN,
        };

        const response: ExistBookingResponse[] = await this.requestApi('/api/Booking', 'POST', requestBody)
            .then(res => res.data)
            .then((res: ExistBookingResponse[]) => res.filter((booking: ExistBookingResponse) => booking.ServiceTypeId == this.config.personalInfo.typeId));
        // if no booking found, the api will return empty array
        if (response.length > 0) return { exist: true, response };
        return { exist: false, response };
    }

    private async cancelBooking(ConfirmationNumber: string) {
        const requestBody: CancelBookingPayload = {
            ConfirmationNumber,
            DateOfBirth: this.config.personalInfo.dob,
            LastFourDigitsSsn: this.config.personalInfo.lastFourSSN,
            FirstName: this.config.personalInfo.firstName,
            LastName: this.config.personalInfo.lastName,
        };
        await this.requestApi('/api/CancelBooking', 'POST', requestBody);
        log.info('Canceled booking successfully');
    }

    public async getResponseId() {
        const requestBody: EligibilityPayload = {
            FirstName: this.config.personalInfo.firstName,
            LastName: this.config.personalInfo.lastName,
            DateOfBirth: this.config.personalInfo.dob,
            LastFourDigitsSsn: this.config.personalInfo.lastFourSSN,
            CardNumber: '',
        };
        const response = await this.requestApi('/api/Eligibility', 'POST', requestBody).then(res => res.data);
        this.responseId = response[0].ResponseId;
        return true;
    }

    public async getAllLocation(): Promise<AvailableLocationResponse[]> {
        const zipcodeList = this.config.location.zipCode;
        const cityNameList = this.config.location.cityName;
        const typeId = this.config.personalInfo.typeId || 71;

        const finalArray: AvailableLocationResponse[] = [];
        if (cityNameList.length > 0 && cityNameList[0] !== '') {
            for (const cityName of cityNameList) {
                const response = await this.getLocationForCity(cityName, typeId);
                finalArray.push(...response);
            }
        } else {
            for (const zipCode of zipcodeList) {
                const response = await this.getLocationForZipCode(zipCode, typeId);
                finalArray.push(...response);
            }
        }
        return this.filterAndSortLocations(finalArray);
    }

    private async getLocationForCity(cityName: string, typeId: number): Promise<AvailableLocationResponse[]> {
        const requestBody: AvailableLocationPayload = {
            CityName: cityName,
            PreferredDay: 0,
            TypeId: typeId,
            ZipCode: '',
        };

        const response = await this.fetchLocationData(requestBody);
        if (response === null) {
            log.warn(`No location found for city: ${cityName}`);
            sleep.setTimeout(2000);
            return [];
        }

        if (response.length !== 0) {
            log.info(`Found ${response.length} locations for City: ${cityName}`);
        }
        response.forEach(el => (el.CityName = cityName));
        return response;
    }

    private async getLocationForZipCode(zipCode: string, typeId: number): Promise<AvailableLocationResponse[]> {
        const requestBody: AvailableLocationPayload = {
            CityName: '',
            PreferredDay: 0,
            TypeId: typeId,
            ZipCode: zipCode,
        };

        const response = await this.fetchLocationData(requestBody);
        if (response === null) {
            log.warn(`No location found for zipcode: ${zipCode}`);
            sleep.setTimeout(2000);
            return [];
        }

        if (response.length !== 0) {
            log.info(`Found ${response.length} locations for zipcode: ${zipCode}`);
        }
        response.forEach(el => (el.ZipCode = zipCode));
        return response;
    }

    private async fetchLocationData(requestBody: AvailableLocationPayload): Promise<AvailableLocationResponse[]> {
        return await this.requestApi('/api/AvailableLocation/', 'POST', requestBody).then(res => res.data as AvailableLocationResponse[]);
    }

    private filterAndSortLocations(locations: AvailableLocationResponse[]): AvailableLocationResponse[] {
        return locations.sort((a, b) => a.Distance - b.Distance).filter((elem, index, self) => self.findIndex(obj => obj.Id === elem.Id) === index);
    }

    public async requestAvailableLocation(): Promise<void> {
        const response = await this.getAllLocation();
        if (response.length === 0) {
            log.error('No Available location found! You can try add more zipcodes or set city name!');
            process.exit(0);
        }
        if (this.config.location.pickDPSLocation) {
            if (existsSync('././cache/location.json')) {
                this.availableLocation = JSON.parse(readFileSync('././cache/location.json', 'utf-8'));
                log.info('Found cached location selection, using cached location selection');
                log.info('If you want to change location selection, please delete cache folder!');
                return;
            }
            const userResponse = await prompts({
                type: 'multiselect',
                name: 'location',
                message: 'Choose DPS location, you can choose multiple locations!',
                choices: response.map(el => ({
                    title: `${el.Name} - ${el.Address} - ${el.Distance} miles away from ${el.ZipCode ? el.ZipCode : el.CityName}!`,
                    value: el,
                })),
                onState: (state: { aborted: boolean }) => (state.aborted ? process.exit(1) : null),
            });
            if (!userResponse.location || userResponse.location.length === 0) {
                log.error('You must choose at least one location!');
                process.exit(1);
            }
            this.availableLocation = userResponse.location;
            writeFileSync('././cache/location.json', JSON.stringify(userResponse.location));
            return;
        }
        const filteredResponse = response.filter((location: AvailableLocationResponse) => location.Distance < this.config.location.miles);
        if (filteredResponse.length === 0) {
            log.error(`No Available location found! Nearest location is ${response[0].Distance} miles away! Please change your config and try again!`);
            process.exit(0);
        }
        log.info(`Found ${filteredResponse.length} Available location that match your criteria`);
        log.info(`${filteredResponse.map(el => el.Name).join(', ')}`);
        this.availableLocation = filteredResponse;
        return;
    }

    private async getLocationDatesAll() {
        log.info('Checking Available Location Dates....');
        if (!this.availableLocation) return;
        const getLocationFunctions = this.availableLocation.map(location => () => sleep.setTimeout(5000).then(() => this.getLocationDates(location)));
        for (;;) {
            console.log('--------------------------------------------------------------------------------');
            await this.queue.addAll(getLocationFunctions).catch(() => null);
            await sleep.setTimeout(this.config.appSettings.interval);
        }
    }

    private async getLocationDates(location: AvailableLocationResponse) {
        const locationConfig = this.config.location;
        const requestBody: AvailableLocationDatesPayload = {
            LocationId: location.Id,
            PreferredDay: 0,
            SameDay: locationConfig.sameDay,
            StartDate: null,
            TypeId: this.config.personalInfo.typeId || 71,
        };
        const response = (await this.requestApi('/api/AvailableLocationDates', 'POST', requestBody).then(res => res.data)) as AvailableLocationDatesResponse;
        let AvailableDates = response.LocationAvailabilityDates;

        if (!locationConfig.sameDay) {
            AvailableDates = response.LocationAvailabilityDates.filter(date => {
                const AvailabilityDate = dayjs(date.AvailabilityDate);
                const startDate = dayjs(this.config.location.daysAround.startDate);
                let preferredDaysCondition = true;
                if (locationConfig.preferredDays.length > 0) preferredDaysCondition = locationConfig.preferredDays.includes(AvailabilityDate.day());
                return (
                    AvailabilityDate.isBetween(startDate.add(locationConfig.daysAround.start, 'day'), startDate.add(locationConfig.daysAround.end, 'day'), 'day') &&
                    date.AvailableTimeSlots.length > 0 &&
                    preferredDaysCondition
                );
            });
        }

        if (AvailableDates.length !== 0) {
            const filteredAvailabilityDates = AvailableDates.map(date => {
                const filteredTimeSlots = date.AvailableTimeSlots.filter(timeSlot => {
                    const startDateTime = dayjs(timeSlot.StartDateTime);
                    const startHour = startDateTime.hour();
                    return startHour >= this.config.location.timesAround.start && startHour < this.config.location.timesAround.end;
                });
                return {
                    ...date,
                    AvailableTimeSlots: filteredTimeSlots,
                };
            }).filter(date => date.AvailableTimeSlots.length > 0);

            const booking = filteredAvailabilityDates[0].AvailableTimeSlots[0];

            log.info(`${location.Name} is Available on ${booking.FormattedStartDateTime}`);
            if (!this.queue.isPaused) this.queue.pause();
            if (!this.config.appSettings.cancelIfExist && this.existBooking?.exist) {
                log.warn('cancelIfExist is disabled! Please cancel existing appointment manually!');
                process.exit(0);
            }
            this.holdSlot(booking, location);
            return Promise.resolve(true);
        }
        log.info(
            `${location.Name} is not Available in ${
                locationConfig.sameDay
                    ? 'the same day'
                    : `around ${locationConfig.daysAround.start}-${locationConfig.daysAround.end} days from ${this.config.location.daysAround.startDate}!`
            } `,
        );

        return Promise.reject();
    }

    private async requestApi(path: string, method: 'GET' | 'POST', body: object, retryTime = 0): Promise<AxiosResponse> {
        const headers = {
            'Content-Type': 'application/json;charset=UTF-8',
            Origin: 'https://public.txdpsscheduler.com',
            Referer: 'https://public.txdpsscheduler.com',
            // 'User-Agent': this.userAgent,
        };
        if (this.authToken) headers['Authorization'] = this.authToken;

        const response = await this.requestClient.request({
            method,
            url: path,
            headers,
            timeout: this.config.appSettings.headersTimeout,
            data: method === 'POST' ? body : undefined, // Include body only for POST requests
            validateStatus: () => true,
        });

        if (response.status !== 200) {
            log.warn(`Got ${response.status} status code`);
            log.info(`Endpoint: ${path}`);
            log.dev(`Auth token: ${headers['Authorization']}`);
            if (response.status === 401) {
                log.info('Auth token expired! Try to get new token...');
                await this.getAuthToken();
                const repsonseIdStatus = await this.getResponseId();

                if (repsonseIdStatus) {
                    log.info('Auth token valid!');
                    log.info('Sleeping for 5s...');
                    await sleep.setTimeout(5000);
                }
            }
            if (response.status === 403) {
                log.warn('Got rate limited, sleep for 10s...');
                await sleep.setTimeout(10000);
                return this.requestApi(path, method, body, retryTime + 1);
            }
            if (retryTime < this.config.appSettings.maxRetry) {
                log.info(`Retrying failed request... (Retry ${retryTime + 1}/${this.config.appSettings.maxRetry})`);
                return this.requestApi(path, method, body, retryTime + 1);
            }
            log.error(`Got ${response.status} status code, retrying failed!`);
            process.exit(1);
        }
        return response;
    }

    private async holdSlot(booking: AvailableTimeSlots, location: AvailableLocationResponse) {
        if (this.isHolded) return;
        const requestBody: HoldSlotPayload = {
            DateOfBirth: this.config.personalInfo.dob,
            FirstName: this.config.personalInfo.firstName,
            LastName: this.config.personalInfo.lastName,
            Last4Ssn: this.config.personalInfo.lastFourSSN,
            SlotId: booking.SlotId,
        };
        const response = (await this.requestApi('/api/HoldSlot', 'POST', requestBody).then(res => res.data)) as HoldSlotResponse;
        if (response.SlotHeldSuccessfully !== true) {
            log.error(`Failed to hold slot: ${response.ErrorMessage}`);
            if (this.queue.isPaused) this.queue.start();
            return;
        }
        log.info('Slot hold successfully. Sleeping for 5s...');
        this.isHolded = true;
        await sleep.setTimeout(5000);
        await this.bookSlot(booking, location);
    }

    private async bookSlot(booking: AvailableTimeSlots, location: AvailableLocationResponse) {
        if (this.isBooked) return;
        log.info('Booking slot....');
        if (this.existBooking?.exist) {
            log.info(`Canceling existing booking ${this.existBooking.response[0].ConfirmationNumber}`);
            await this.cancelBooking(this.existBooking.response[0].ConfirmationNumber);
        }
        const requestBody: BookSlotPayload = {
            AdaRequired: false,
            BookingDateTime: booking.StartDateTime,
            BookingDuration: booking.Duration,
            CardNumber: '',
            CellPhone: this.config.personalInfo.phoneNumber ? this.config.personalInfo.phoneNumber : '',
            DateOfBirth: this.config.personalInfo.dob,
            Email: this.config.personalInfo.email,
            FirstName: this.config.personalInfo.firstName,
            LastName: this.config.personalInfo.lastName,
            HomePhone: '',
            Last4Ssn: this.config.personalInfo.lastFourSSN,
            ResponseId: this.responseId,
            SendSms: this.config.personalInfo.phoneNumber ? true : false,
            ServiceTypeId: this.config.personalInfo.typeId || 71,
            SiteId: location.Id,
            SpanishLanguage: 'N',
        };

        const response = await this.requestApi('/api/NewBooking', 'POST', requestBody);
        if (response.status === 200) {
            const bookingInfo = response.data as BookSlotResponse;
            if (bookingInfo?.Booking === null) {
                if (this.queue.isPaused) this.queue.start();
                log.error('Failed to book slot');
                log.error(JSON.stringify(bookingInfo));
                this.isHolded = false;
                return;
            }
            const appointmentURL = `https://public.txdpsscheduler.com/?b=${bookingInfo.Booking.ConfirmationNumber}`;
            this.isBooked = true;
            log.info(`Slot booked successfully. Confirmation Number: ${bookingInfo.Booking.ConfirmationNumber}`);
            log.info(`Visiting this link to print your booking:`);
            log.info(appointmentURL);
            if (this.config.appSettings.pushNotifcation.enabled) {
                log.info('Sending notification...');
                await pushNotifcation(`Booked for ${this.config.personalInfo.firstName} ${this.config.personalInfo.lastName}. URL: ${appointmentURL}`).catch(error => {
                    log.error('Failed to send notification', error);
                });
            }
            process.exit(0);
        } else {
            if (this.queue.isPaused) this.queue.start();
            log.error('Failed to book slot');
            log.error(response.data);
        }
    }

    private async getAuthToken() {
        if (this.config.appSettings.captcha.strategy === 'solver') {
            const captchaToken = await this.getCaptchaToken();
            const requestBody: AuthPayload = {
                UserName: `${this.config.personalInfo.firstName}_${this.config.personalInfo.lastName}_${this.config.personalInfo.lastFourSSN}`,
                RecaptchaToken: {
                    Action: 'login',
                    Token: captchaToken,
                },
            };

            log.dev(`Captcha token: ${captchaToken}`);
            log.dev(`Request body: ${JSON.stringify(requestBody)}`);
            const response = (await this.requestApi('/api/Auth', 'POST', requestBody).then(res => res.data)) as string;
            this.authToken = response;
        } else if (this.config.appSettings.captcha.strategy === 'browser') {
            const token = await getAuthTokenFromBroswer();
            this.authToken = token;
        } else if (this.config.appSettings.captcha.strategy === 'manual') {
            const response = await prompts({
                type: 'text',
                name: 'token',
                message: 'Your captcha token is expired. Enter the new token: ',
                onState: (state: { aborted: boolean }) => (state.aborted ? process.exit(1) : null),
            });
            this.authToken = response.token;
        }

        if (this.authToken) {
            writeFileSync('././cache/token.tmp', this.authToken);
        }
    }

    private async getCaptchaToken(taskId?: string | null, retries = 0): Promise<string> {
        if (retries > this.maxCaptchaSolverRetries) {
            log.error(`Get captcha token failed after ${this.maxCaptchaSolverRetries} retries! will retry!`);
            return await this.getCaptchaToken(null, 0);
        }
        if (!taskId) taskId = await CreateCaptchaSolverTask();
        const captchaToken = await this.getCaptchaResult(taskId);
        if (captchaToken === undefined) {
            await sleep.setTimeout(2000);
            return this.getCaptchaToken(taskId, retries + 1);
        }
        if (captchaToken === null) {
            log.error('get captcha token failed! will create new task and sleep 10s!');
            await sleep.setTimeout(10000);
            return this.getCaptchaToken(null, retries + 1);
        }
        log.info('Captcha token received successfully');
        return captchaToken;
    }

    private async getCaptchaResult(taskId: string | null): Promise<string | undefined | null> {
        if (!taskId) return null;
        log.info(`Waiting for captcha token from task ${taskId}...`);
        try {
            const captchaResult = await GetCaptchaSolverResult(taskId);
            if (captchaResult.status !== 'ready') {
                if (captchaResult.status === 'processing') return undefined;
                else return null;
            }
            return captchaResult.solution.gRecaptchaResponse;
        } catch (err) {
            log.error('Error while getting captcha token: ', err as Error);
            return null;
        }
    }
}

export default TexasScheduler;
