import { readFileSync, existsSync } from 'fs';
import YAML from 'yaml';

import preferredDayList from '../Assets/preferredDay';

const parseConfig = (): Config => {
    if (!existsSync('./config.yml')) {
        console.error('[ERROR] Not found config.yml file');
        process.exit(0);
    }

    const file = readFileSync('././config.yml', 'utf8');
    const configData = YAML.parse(file);
    configData.location.preferredDays = parsePreferredDays(configData.location.preferredDays);
    configData.personalInfo.phoneNumber = parsePhoneNumber(configData.personalInfo.phoneNumber);
    return configData;
};

export default parseConfig;

function parsePhoneNumber(phoneNumber: string) {
    if (!phoneNumber) return null;
    // Phone format is ########## and we want to convert it to (###) ###-####
    return phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
}

function parsePreferredDays(preferredDay: string): number {
    preferredDay = preferredDay.toLowerCase();
    if (preferredDayList[preferredDay]) return preferredDayList[preferredDay];
    else return 0;
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
