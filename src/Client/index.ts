import undici from 'undici';
import pQueue from 'p-queue';
import sleep from 'timers/promises';
import parseConfig from '../Config';
import * as log from '../Log';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(isBetween);
import prompts from 'prompts';

import type { EligibilityPayload } from '../Interfaces/Eligibility';
import type { AvaliableLocationPayload, AvaliableLocationResponse } from '../Interfaces/AvaliableLocation';
import type { AvaliableLocationDatesPayload, AvaliableLocationDatesResponse, AvaliableTimeSlots } from '../Interfaces/AvaliableLocationDates';
import type { HoldSlotPayload, HoldSlotResponse } from '../Interfaces/HoldSlot';
import type { BookSlotPayload, BookSlotResponse } from '../Interfaces/BookSlot';
import type { ExistBookingPayload, ExistBookingResponse } from '../Interfaces/ExistBooking';
import type { CancelBookingPayload } from '../Interfaces/CancelBooking';
import type { webhookPayload } from '../Interfaces/webhook';

class TexasScheduler {
    public requestInstance = new undici.Pool('https://publicapi.txdpsscheduler.com');
    public config = parseConfig();
    private avaliableLocation: AvaliableLocationResponse[] | null = null;
    private isBooked = false;
    private isHolded = false;
    public existBooking: { exist: boolean; response: ExistBookingResponse[] } | undefined;
    private queue = new pQueue({ concurrency: 1 });

    public constructor() {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, prettier/prettier
        if (this.config.appSettings.webserver) require('http').createServer((req: any, res: any) => res.end('Bot is alive!')).listen(process.env.PORT || 3000);
        log.info('Texas Scheduler is starting...');
        log.info('Requesting Avaliable Location....');
        this.run();
    }

    public async run() {
        this.existBooking = await this.checkExistBooking();
        const { exist, response } = this.existBooking;
        if (exist) {
            log.warn(`You have an existing booking at ${response[0].SiteName} ${dayjs(response[0].BookingDateTime).format('MM/DD/YYYY hh:mm A')}`);
            log.warn(`The bot will continue to run, but will cancel existing booking if it found a new one`);
        }
        await this.requestAvaliableLocation();
        await this.getLocationDatesAll();
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
        if (response.statusCode === 200) log.info('Canceled booking successfully');
        else {
            log.error('Failed to cancel booking. Please cancel it manually');
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
            .then((res: AvaliableLocationResponse[]) => res.sort((a, b) => a.Distance - b.Distance));
        if (this.config.location.pickDPSLocation) {
            const userResponse = await prompts({
                type: 'multiselect',
                name: 'location',
                message: 'Choose DPS location, you can choose multiple location!',
                choices: response.map(el => ({ title: `${el.Name} - ${el.Address} - ${el.Distance} miles away!`, value: el })),
            });
            if (!userResponse.location || userResponse.location.length === 0) {
                log.error('You must choose at least one location!');
                process.exit(1);
            }
            this.avaliableLocation = userResponse.location;
            return;
        }
        const filteredResponse = response.filter((location: AvaliableLocationResponse) => location.Distance < this.config.location.miles);
        if (filteredResponse.length === 0) {
            log.error(`No avaliable location found! Nearest location is ${response[0].Distance} miles away! Please change your config and try again!`);
            process.exit(0);
        }
        log.info(`Found ${response.length} avaliable location that match your criteria`);
        log.info(`${response.map(el => el.Name).join(', ')}`);
        this.avaliableLocation = response;
        return;
    }

    private async getLocationDatesAll() {
        log.info('Checking Avaliable Location Dates....');
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
        const avaliableDates = response.LocationAvailabilityDates.filter(date => {
            const AvailabilityDate = dayjs(date.AvailabilityDate);
            const today = dayjs();
            return (
                AvailabilityDate.isBetween(today.subtract(this.config.location.daysAround.start, 'day'), today.add(this.config.location.daysAround.end, 'day'), 'day') &&
                date.AvailableTimeSlots.length > 0
            );
        });
        if (avaliableDates.length !== 0) {
            const booking = avaliableDates[0].AvailableTimeSlots[0];
            log.info(`${location.Name} is avaliable on ${booking.FormattedStartDateTime}`);
            if (!this.queue.isPaused) this.queue.pause();
            if (!this.config.appSettings.cancelIfExist) {
                log.warn('cancelIfExist is disabled! Please cancel existing appointment manually!');
                process.exit(0);
            }
            this.holdSlot(booking, location);
            return Promise.resolve(true);
        }
        log.info(`${location.Name} is not avaliable in around ${this.config.location.daysAround.start}-${this.config.location.daysAround.end} days from today!`);
        return Promise.reject();
    }

    private async requestApi(path: string, method: 'GET' | 'POST', body: object) {
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
            log.error('Failed to hold slot');
            if (this.queue.isPaused) this.queue.start();
            return;
        }
        log.info('Slot hold successfully');
        this.isHolded = true;
        await this.bookSlot(booking, location);
    }

    private async bookSlot(booking: AvaliableTimeSlots, location: AvaliableLocationResponse) {
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
            const bookingInfo: BookSlotResponse = await response.body.json();
            const appointmentURL = `https://public.txdpsscheduler.com/?b=${bookingInfo.Booking.ConfirmationNumber}`;
            this.isBooked = true;
            log.info(`Slot booked successfully. Confirmation Number: ${bookingInfo.Booking.ConfirmationNumber}`);
            log.info(`Visiting this link to print your booking:`);
            log.info(appointmentURL);
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
            log.error('Failed to book slot');
            log.error(await response.body.text());
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
        if (response.statusCode === 200) log.info('[INFO] Webhook sent successfully');
        else {
            log.error('Failed to send webhook');
            log.error(await response.body.text());
        }
    }
}

export default TexasScheduler;
