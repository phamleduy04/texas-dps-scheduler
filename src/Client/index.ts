import { readFileSync, existsSync } from 'fs';
import YAML from 'yaml';
import undici from 'undici';
import ms from 'ms';
import pQueue from 'p-queue';
import sleep from 'timers/promises';

import type { HttpMethod } from 'undici/types/dispatcher';
import type { EligibilityPayload } from '../Interfaces/Eligibility';
import type { AvaliableLocationPayload, AvaliableLocationResponse } from '../Interfaces/AvaliableLocation';
import type { AvaliableLocationDatesPayload, AvaliableLocationDatesResponse, AvaliableTimeSlots } from '../Interfaces/AvaliableLocationDates';
import type { HoldSlotPayload, HoldSlotResponse } from '../Interfaces/HoldSlot';
import type { BookSlotPayload, BookSlotResponse } from '../Interfaces/BookSlot';
import type { ExistBookingPayload, ExistBookingResponse } from '../Interfaces/ExistBooking';
import type { CancelBookingPayload } from '../Interfaces/CancelBooking';
import type { webhookPayload } from '../Interfaces/webhook';

import preferredDayList from '../Assets/preferredDay';

class TexasScheduler {
    public requestInstance = new undici.Pool('https://publicapi.txdpsscheduler.com');
    public config = this.parseConfig();
    private avaliableLocation: AvaliableLocationResponse[] | null = null;
    private isBooked = false;
    private isHolded = false;
    private queue = new pQueue();

    public constructor() {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, prettier/prettier
        if (this.config.appSettings.webserver) require('http').createServer((req: any, res: any) => res.end('Bot is alive!')).listen(process.env.PORT || 3000);
        console.info('[INFO] Texas Scheduler is starting...');
        console.info('[INFO] Requesting Avaliable Location....');
        this.run();
    }

    public async run() {
        const existBooking = await this.checkExistBooking();
        if (existBooking.exist) {
            console.log(`[INFO] You have an existing booking at ${existBooking.response[0].SiteName}`);
            if (this.config.appSettings.cancelIfExist) {
                console.log('[INFO] Canceling existing booking....');
                await this.cancelBooking(existBooking.response[0].ConfirmationNumber);
            } else {
                console.error('[ERROR] You have existing booking, please cancel it first');
                process.exit(0);
            }
        }
        await this.requestAvaliableLocation();
        await this.getLocationDatesAll();
    }

    public parseConfig(): Config {
        if (!existsSync('./config.yml')) {
            console.error('[ERROR] Not found config.yml file');
            process.exit(0);
        }

        const file = readFileSync('././config.yml', 'utf8');
        const configData = YAML.parse(file);
        configData.location.preferredDays = this.parsePreferredDays(configData.location.preferredDays);
        configData.personalInfo.phoneNumber = this.parsePhoneNumber(configData.personalInfo.phoneNumber);
        return configData;
    }

    private async checkExistBooking() {
        const requestBody: ExistBookingPayload = {
            FirstName: this.config.personalInfo.firstName,
            LastName: this.config.personalInfo.lastName,
            DateOfBirth: this.config.personalInfo.dob,
            LastFourDigitsSsn: this.config.personalInfo.lastFourSSN,
        };

        const response: ExistBookingResponse[] = await this.requestApi('/api/Booking', 'POST', requestBody).then(res => res.body.json());
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
        const response = await this.requestApi('/api/CancelBooking', 'POST', requestBody);
        if (response.statusCode === 200) console.log('[INFO] Canceled booking successfully');
        else {
            console.error('[ERROR] Failed to cancel booking. Please cancel it manually');
            process.exit(0);
        }
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

    public async requestAvaliableLocation(): Promise<void> {
        const requestBody: AvaliableLocationPayload = {
            CityName: '',
            PreferredDay: this.config.location.preferredDays,
            // 71 is new driver license
            TypeId: this.config.personalInfo.typeId || 71,
            ZipCode: this.config.location.zipCode,
        };
        const response: AvaliableLocationResponse[] = await this.requestApi('/api/AvailableLocation/', 'POST', requestBody)
            .then(res => res.body.json())
            .then(res => res.filter((location: AvaliableLocationResponse) => location.Distance < this.config.location.miles));
        console.log(`[INFO] Found ${response.length} avaliable location that match your criteria`);
        console.log(`[INFO] ${response.map(el => el.Name).join(', ')}`);
        this.avaliableLocation = response;
        return;
    }

    private async getLocationDatesAll() {
        console.log('[INFO] Checking Avaliable Location Dates....');
        if (!this.avaliableLocation) return;
        const getLocationFunctions = this.avaliableLocation.map(location => () => this.getLocationDates(location));
        for (;;) {
            console.log('--------------------------------------------------------------------------------');
            await this.queue.addAll(getLocationFunctions).catch(() => null);
            await sleep.setTimeout(this.config.appSettings.interval);
        }
    }

    private async getLocationDates(location: AvaliableLocationResponse) {
        const requestBody: AvaliableLocationDatesPayload = {
            LocationId: location.Id,
            PreferredDay: this.config.location.preferredDays,
            SameDay: this.config.location.sameDay,
            StartDate: null,
            TypeId: this.config.personalInfo.typeId || 71,
        };
        const response: AvaliableLocationDatesResponse = await this.requestApi('/api/AvailableLocationDates', 'POST', requestBody).then(res => res.body.json());
        const avaliableDates = response.LocationAvailabilityDates.filter(
            date => new Date(date.AvailabilityDate).valueOf() - new Date().valueOf() < ms(`${this.config.location.daysAround}d`) && date.AvailableTimeSlots.length > 0,
        );
        if (avaliableDates.length !== 0) {
            const booking = avaliableDates[0].AvailableTimeSlots[0];
            console.log(`[INFO] ${location.Name} is avaliable on ${booking.FormattedStartDateTime}`);
            if (!this.queue.isPaused) this.queue.pause();
            this.holdSlot(booking, location);
            return Promise.resolve(true);
        }
        console.log(`[INFO] ${location.Name} is not avaliable in around ${this.config.location.daysAround} days`);
        return Promise.reject();
    }

    private async requestApi(path: string, method: HttpMethod, body: object) {
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
        return await response;
    }

    private async holdSlot(booking: AvaliableTimeSlots, location: AvaliableLocationResponse) {
        if (this.isHolded) return;
        const requestBody: HoldSlotPayload = {
            DateOfBirth: this.config.personalInfo.dob,
            FirstName: this.config.personalInfo.firstName,
            LastName: this.config.personalInfo.lastName,
            Last4Ssn: this.config.personalInfo.lastFourSSN,
            SlotId: booking.SlotId,
        };
        const response: HoldSlotResponse = await this.requestApi('/api/HoldSlot', 'POST', requestBody).then(res => res.body.json());
        if (response.SlotHeldSuccessfully !== true) {
            console.log('[INFO] Failed to hold slot');
            if (this.queue.isPaused) this.queue.start();
            return;
        }
        console.log('[INFO] Slot hold successfully');
        this.isHolded = true;
        await this.bookSlot(booking, location);
    }

    private async bookSlot(booking: AvaliableTimeSlots, location: AvaliableLocationResponse) {
        if (this.isBooked) return;
        console.log('[INFO] Booking slot....');
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
            const bookingInfo: BookSlotResponse = await response.body.json();
            const appointmentURL = `https://public.txdpsscheduler.com/?b=${bookingInfo.Booking.ConfirmationNumber}`;
            this.isBooked = true;
            console.log(`[INFO] Slot booked successfully. Confirmation Number: ${bookingInfo.Booking.ConfirmationNumber}`);
            console.log(`[INFO] Visiting this link to print your booking:`);
            console.log(`[INFO] ${appointmentURL}`);
            if (this.config.webhook.enable)
                await this.sendWebhook(
                    // this string kinda long so i put it in a array and join it :)
                    [
                        `Booking for ${this.config.personalInfo.firstName} ${this.config.personalInfo.lastName} has been booked.`,
                        `Confirmation Number: ${bookingInfo.Booking.ConfirmationNumber}`,
                        `Location: ${location.Name} DPS`,
                        `Time: ${booking.FormattedStartDateTime}`,
                        `Appointment URL: ${appointmentURL}`,
                    ].join('\n'),
                );
            process.exit(0);
        } else {
            if (this.queue.isPaused) this.queue.start();
            console.log('[INFO] Failed to book slot');
            console.log(await response.body.text());
        }
    }

    private async sendWebhook(message: string) {
        const requestBody: webhookPayload = {
            chatGuid: `${this.config.webhook.phoneNumberType};-;${this.config.webhook.phoneNumber}`,
            tempGuild: '',
            message,
            method: this.config.webhook.sendMethod,
            subject: '',
            effectId: '',
            selectedMessageGuild: '',
        };
        const response = await undici.request(`${this.config.webhook.url}/api/v1/message/text?password=${this.config.webhook.password}`, {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: { 'Content-Type': 'application/json' },
        });
        if (response.statusCode === 200) console.log('[INFO] Webhook sent successfully');
        else {
            console.log('[ERROR] Failed to send webhook');
            console.log(await response.body.text());
        }
    }

    private parsePhoneNumber(phoneNumber: string) {
        if (!phoneNumber) return null;
        // Phone format is ########## and we want to convert it to (###) ###-####
        return phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    }

    private parsePreferredDays(preferredDay: string): number {
        preferredDay = preferredDay.toLowerCase();
        if (preferredDayList[preferredDay]) return preferredDayList[preferredDay];
        else return 0;
    }
}

interface Config {
    personalInfo: personalInfo;
    location: location;
    appSettings: appSettings;
    webhook: webhook;
}

interface personalInfo {
    firstName: string;
    lastName: string;
    dob: string;
    email: string;
    lastFourSSN: string;
    phoneNumber?: string;
    typeId?: number;
}

interface location {
    zipCode: string;
    miles: number;
    preferredDays: number;
    sameDay: boolean;
    daysAround: number;
}

interface appSettings {
    cancelIfExist: boolean;
    interval: number;
    webserver: boolean;
    headersTimeout: number;
}

interface webhook {
    enable: boolean;
    url: string;
    password: string;
    phoneNumber: string;
    sendMethod: 'private-api' | 'apple-script';
    phoneNumberType: 'iMessage' | 'SMS';
}
export default TexasScheduler;
