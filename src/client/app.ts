import { readFileSync, existsSync } from 'fs';
import YAML from 'yaml';
import undici from 'undici';
import type { HttpMethod } from 'undici/types/dispatcher';
import ms from 'ms';

import type { EligibilityPayload } from '../Interfaces/Eligibility';
import type { AvaliableLocationPayload, AvaliableLocationResponse } from '../Interfaces/AvaliableLocation';
import type { AvaliableLocationDatesPayload, AvaliableLocationDatesResponse, AvaliableTimeSlots } from '../Interfaces/AvaliableLocationDates';
import type { HoldSlotPayload, HoldSlotResponse } from '../Interfaces/HoldSlot';
import type { BookSlotPayload } from '../Interfaces/BookSlot';

const preferredDayList: any = import('../assets/preferredDay.json');

class TexasScheduler {
    public requestInstance = new undici.Pool('https://publicapi.txdpsscheduler.com');
    public config = this.parseConfig();
    public avaliableLocation : AvaliableLocationResponse[] | null = null;
    public constructor() {
        console.info('[INFO] Texas Scheduler is starting...');
        console.info('[INFO] Requesting Avaliable Location....');
        this.run();
    }

    public async run() {
        await this.requestAvaliableLocation();
        await this.getLocationDatesAll();
        setInterval(() => this.getLocationDatesAll(), ms('10s'));
    }

    public parseConfig():Config {
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

    public async getResponseId() {
        const requestBody : EligibilityPayload = {
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
        const requestBody : AvaliableLocationPayload = {
            CityName: "",
            PreferredDay: this.config.location.preferredDays,
            // 71 is new driver license
            TypeId: 71,
            ZipCode: this.config.location.zipCode,
        };
        const response:AvaliableLocationResponse[] = await this.requestApi('/api/AvailableLocation/', 'POST', requestBody)
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
        for (const location of this.avaliableLocation) {
            const locationData = await this.getLocationDates(location);
            if (locationData.LocationAvailabilityDates?.length === 0) {
                console.log(`[INFO] ${location.Name} is not avaliable`);
                continue;
            } else {
                // filter avaliable dates that's under 7 days
                const avaliableDates = locationData.LocationAvailabilityDates.filter(date => new Date(date.AvailabilityDate).valueOf() - new Date().valueOf() < ms('120d') && date.AvailableTimeSlots.length > 0);
                if (avaliableDates.length === 0) {
                    console.log(`[INFO] ${location.Name} is not avaliable in around 7 days`);
                    continue;
                } else {
                    // console.log(avaliableDates);
                    const booking = avaliableDates[0].AvailableTimeSlots[0]
                    console.log(`[INFO] ${location.Name} is avaliable on ${booking.FormattedStartDateTime}`);
                    this.holdSlot(booking, location.Id);
                    break;
                }
            }
        }
    }

    private async getLocationDates(location: AvaliableLocationResponse) {
        const requestBody: AvaliableLocationDatesPayload = {
            LocationId: location.Id,
            PreferredDay: this.config.location.preferredDays,
            SameDay: this.config.location.sameDay,
            StartDate: null,
            TypeId: 71,
        }
        const response : AvaliableLocationDatesResponse = await this.requestApi('/api/AvailableLocationDates', 'POST', requestBody).then(res => res.body.json());
        return response;
    }

    private async requestApi(path: string, method: HttpMethod , body: object) {
        const response = await this.requestInstance.request({
            method,
            path,
            headers: {
                'Content-Type': 'application/json;charset=UTF-8', 
                'Origin': 'https://public.txdpsscheduler.com', 
                'Referer': 'https://public.txdpsscheduler.com/'
            },
            body: JSON.stringify(body),
        });
        return await response;
    } 

    private async holdSlot(booking : AvaliableTimeSlots, locationId: number) {
        const requestBody : HoldSlotPayload = {
            DateOfBirth: this.config.personalInfo.dob,
            FirstName: this.config.personalInfo.firstName,
            LastName: this.config.personalInfo.lastName,
            Last4Ssn: this.config.personalInfo.lastFourSSN,
            SlotId: booking.SlotId,
        };
        const response : HoldSlotResponse = await this.requestApi('/api/HoldSlot', 'POST', requestBody).then(res => res.body.json());
        if (response.SlotHeldSuccessfully !== true) {
            console.log('[INFO] Failed to hold slot');
            return;
        }
        console.log('[INFO] Slot hold successfully');
        await this.sleep(2000);
        await this.bookSlot(booking, locationId);
    }

    private async bookSlot(booking: AvaliableTimeSlots, locationId: number) {
        console.log('[INFO] Booking slot....');
        const requestBody: BookSlotPayload = {
            AdaRequired: false,
            BookingDateTime: booking.StartDateTime,
            BookingDuration: booking.Duration,
            CardNumber: "",
            CellPhone: this.config.personalInfo.phoneNumber ? this.config.personalInfo.phoneNumber : "",
            DateOfBirth: this.config.personalInfo.dob,
            Email: this.config.personalInfo.email,
            FirstName: this.config.personalInfo.firstName,
            LastName: this.config.personalInfo.lastName,
            HomePhone: "",
            Last4Ssn: this.config.personalInfo.lastFourSSN,
            ResponseId: await this.getResponseId(),
            SendSms: this.config.personalInfo.phoneNumber ? true : false,
            ServiceTypeId: 71,
            SiteId: locationId,
            SpanishLanguage: "N"
        };

        const response = await this.requestApi('/api/NewBooking', 'POST', requestBody);
        if (response.statusCode === 200) {
            console.log('[INFO] Slot booked successfully');
            process.exit(0);
        } else {
            console.log('[INFO] Failed to book slot');
            console.log(await response.body.text())
        }
    }

    private parsePhoneNumber(phoneNumber: string) {
        if (!phoneNumber) return null;
        // Phone format is ########## and we want to convert it to (###) ###-####
        return phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    }

    private parsePreferredDays(preferredDay: string):number {
        preferredDay = preferredDay.toLowerCase();
        if (preferredDayList[preferredDay]) return preferredDayList[preferredDay];
        else return 0;
    }

    private async sleep(miliseconds: number) {
        return new Promise(resolve => setTimeout(resolve, miliseconds));
    }
}

interface Config {
    personalInfo: personalInfo,
    location: location,
}

interface personalInfo {
    firstName: string,
    lastName: string,
    dob: string,
    email: string,
    lastFourSSN: string,
    phoneNumber?: string,
}

interface location {
    interval: number,
    zipCode: string,
    miles: number,
    preferredDays: number,
    sameDay: boolean,
}

export default TexasScheduler;