import undici, { Dispatcher } from 'undici';
import pQueue from 'p-queue';
import sleep from 'timers/promises';
import parseConfig from '../Config';
import * as log from '../Log';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(isBetween);
import prompts from 'prompts';
import type { EligibilityPayload } from '../Interfaces/Eligibility';
import type { AvailableLocationPayload, AvailableLocationResponse } from '../Interfaces/AvailableLocation';
import type { AvailableLocationDatesPayload, AvailableLocationDatesResponse, AvailableTimeSlots } from '../Interfaces/AvailableLocationDates';
import type { HoldSlotPayload, HoldSlotResponse } from '../Interfaces/HoldSlot';
import type { BookSlotPayload, BookSlotResponse } from '../Interfaces/BookSlot';
import type { ExistBookingPayload, ExistBookingResponse } from '../Interfaces/ExistBooking';
import type { CancelBookingPayload } from '../Interfaces/CancelBooking';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
let packagejson;
try {
    packagejson = require('../../package.json');
} catch {
    try {
        packagejson = require('../package.json');
    } catch {
        packagejson.version = null;
    }
}
class TexasScheduler {
    public requestInstance = new undici.Pool('https://publicapi.txdpsscheduler.com');
    public config = parseConfig();
    public existBooking: { exist: boolean; response: ExistBookingResponse[] } | undefined;

    private availableLocation: AvailableLocationResponse[] | null = null;
    private isBooked = false;
    private isHolded = false;
    private queue = new pQueue({ concurrency: 1 });

    public constructor() {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, prettier/prettier
        if (this.config.appSettings.webserver) require('http').createServer((req: any, res: any) => res.end('Bot is alive!')).listen(process.env.PORT || 3000);
        log.info(`Texas Scheduler v${packagejson.version} is starting...`);
        log.info('Requesting Available Location....');
        if (!existsSync('cache')) mkdirSync('cache');
        this.run();
    }

    public async run() {
        this.existBooking = await this.checkExistBooking();
        const { exist, response } = this.existBooking;
        if (exist) {
            log.warn(`You have an existing booking at ${response[0].SiteName} ${dayjs(response[0].BookingDateTime).format('MM/DD/YYYY hh:mm A')}`);
            log.warn(`The bot will continue to run, but will cancel existing booking if it found a new one`);
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
            .then(res => res.body.json())
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
        const response = await this.requestApi('/api/Eligibility', 'POST', requestBody).then(res => res.body.json());
        return response[0].ResponseId;
    }

    public async getAllLocationFromZipCodes(): Promise<AvailableLocationResponse[]> {
        const zipcodeList = this.config.location.zipCode;
        const finalArray: AvailableLocationResponse[] = [];
        for (let i = 0; i < zipcodeList.length; i++) {
            const requestBody: AvailableLocationPayload = {
                CityName: '',
                PreferredDay: 0,
                // 71 is new driver license
                TypeId: this.config.personalInfo.typeId || 71,
                ZipCode: zipcodeList[i],
            };
            const response: AvailableLocationResponse[] = await this.requestApi('/api/AvailableLocation/', 'POST', requestBody).then(
                res => res.body.json() as Promise<AvailableLocationResponse[]>,
            );
            response.forEach(el => (el.ZipCode = zipcodeList[i]));
            finalArray.push(...response);
        }

        return finalArray.sort((a, b) => a.Distance - b.Distance).filter((elem, index) => finalArray.findIndex(obj => obj.Id === elem.Id) === index);
    }
    public async requestAvailableLocation(): Promise<void> {
        const response = await this.getAllLocationFromZipCodes();
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
                message: 'Choose DPS location, you can choose multiple location!',
                choices: response.map(el => ({ title: `${el.Name} - ${el.Address} - ${el.Distance} miles away from ${el.ZipCode}!`, value: el })),
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
        const getLocationFunctions = this.availableLocation.map(location => () => this.getLocationDates(location));
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
        const response = (await this.requestApi('/api/AvailableLocationDates', 'POST', requestBody).then(res => res.body.json())) as AvailableLocationDatesResponse;
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

    private async requestApi(path: string, method: 'GET' | 'POST', body: object, retryTime = 0): Promise<Dispatcher.ResponseData> {
        const response = await this.requestInstance.request({
            method,
            path,
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                Origin: 'https://public.txdpsscheduler.com',
                Referer: 'https://public.txdpsscheduler.com/',
            },
            headersTimeout: this.config.appSettings.headersTimeout,
            body: JSON.stringify(body),
        });
        if (response.statusCode !== 200) {
            if (retryTime < this.config.appSettings.maxRetry) {
                log.warn(`Got ${response.statusCode} status code, retrying...`);
                log.error((await response.body.text()) ?? '');
                return this.requestApi(path, method, body, retryTime + 1);
            }
            log.error(`Got ${response.statusCode} status code, retrying failed!`);
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
        const response = (await this.requestApi('/api/HoldSlot', 'POST', requestBody).then(res => res.body.json())) as HoldSlotResponse;
        if (response.SlotHeldSuccessfully !== true) {
            log.error(`Failed to hold slot: ${response.ErrorMessage}`);
            if (this.queue.isPaused) this.queue.start();
            return;
        }
        log.info('Slot hold successfully');
        this.isHolded = true;
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
            ResponseId: await this.getResponseId(),
            SendSms: this.config.personalInfo.phoneNumber ? true : false,
            ServiceTypeId: this.config.personalInfo.typeId || 71,
            SiteId: location.Id,
            SpanishLanguage: 'N',
        };

        const response = await this.requestApi('/api/NewBooking', 'POST', requestBody);
        if (response.statusCode === 200) {
            const bookingInfo = (await response.body.json()) as BookSlotResponse;
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
            process.exit(0);
        } else {
            if (this.queue.isPaused) this.queue.start();
            log.error('Failed to book slot');
            log.error(await response.body.text());
        }
    }
}

export default TexasScheduler;
