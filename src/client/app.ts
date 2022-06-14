import { readFileSync, existsSync } from 'fs';
import YAML from 'yaml';
import undici from 'undici';
const preferredDayList: any = import('../assets/preferredDay.json');
import type { AvaliableLocationPayload, AvaliableLocationResponse } from '../Interfaces/AvaliableLocation';
import type { AvaliableLocationDatesPayload, AvaliableLocationDatesResponse } from '../Interfaces/AvaliableLocationDates';
import type { HttpMethod } from 'undici/types/dispatcher';


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

    }

    public parseConfig():Config {
        if (!existsSync('./config.yml')) {
            console.error('[ERROR] Not found config.yml file');
            process.exit(0);
        }
    
        const file = readFileSync('././config.yml', 'utf8');
        const configData = YAML.parse(file);
        configData.location.preferredDays = this.parsePreferredDays(configData.location.preferredDays);
        return configData;
    }

    public async requestAvaliableLocation(): Promise<void> {
        const requestBody : AvaliableLocationPayload = {
            CityName: "",
            PreferredDay: this.config.location.preferredDays,
            // 71 is new driver license
            TypeId: 71,
            ZipCode: this.config.location.zipCode,
        };
        const response:AvaliableLocationResponse[] = await this.requestApi('/api/AvailableLocation/', 'POST', requestBody).then(res => res.filter((location: AvaliableLocationResponse) => location.Distance < this.config.location.miles));
        console.log(`[INFO] Found ${response.length} avaliable location that match your criteria`);
        console.log(`[INFO] ${response.map(el => el.Name).join(', ')}`);
        this.avaliableLocation = response;
        return;
    }

    private async getLocationDatesAll() {
        if (!this.avaliableLocation) return;
        this.avaliableLocation.forEach(location => {

        });
    }

    private async getLocationDates(location: AvaliableLocationResponse) {
        const requestBody: AvaliableLocationDatesPayload = {
            LocationId: location.Id,
            PreferredDay: this.config.location.preferredDays,
            SameDay: this.config.location.sameDay,
            StartDate: null,
            TypeId: 71,
        }
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
        return await response.body.json();
    }

    



    private parsePreferredDays(preferredDay: string):number {
        preferredDay = preferredDay.toLowerCase();
        if (preferredDayList[preferredDay]) return preferredDayList[preferredDay];
        else return 0;
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
    lastFourSSN?: string,
}

interface location {
    interval: number,
    zipCode: string,
    miles: number,
    preferredDays: number,
    sameDay: boolean,
}

export default TexasScheduler;