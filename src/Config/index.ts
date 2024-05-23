import { readFileSync, existsSync } from 'fs';
import YAML from 'yaml';
import { configZod, Config } from '../Interfaces/Config';
import preferredDayList from '../Assets/preferredDay';
import * as log from '../Log';
import 'dotenv/config';
import dayjs from 'dayjs';

const parseConfig = (): Config => {
    if (!existsSync('./config.yml')) {
        log.error('Not found config.yml file');
        process.exit(0);
    }

    const file = readFileSync('././config.yml', 'utf8');
    let configData = YAML.parse(file);
    configData = parsePersonalInfo(configData);
    configData.location.preferredDays = parsePreferredDays(configData.location.preferredDays);
    configData.personalInfo.phoneNumber = parsePhoneNumber(configData.personalInfo.phoneNumber);
    let startDate = dayjs(configData.location.daysAround.startDate);
    if (!configData.location.daysAround.startDate || !startDate.isValid() || startDate.isBefore(dayjs())) {
        log.warn('Invalid date in config.yml, using current date');
        startDate = dayjs();
    }
    configData.location.daysAround.startDate = startDate.format('MM/DD/YYYY');

    try {
        return configZod.parse(configData);
    } catch (e) {
        log.error('Config file is not valid');
        console.error(e);
        process.exit(1);
    }
};

export default parseConfig;

function parsePhoneNumber(phoneNumber: string) {
    if (!phoneNumber) return null;
    // Phone format is ########## and we want to convert it to (###) ###-####
    return phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
}

function parsePreferredDays(preferredDay: string[]): number[] {
    const convertedPreferredDay = preferredDay.map(day => preferredDayList[day.toLowerCase()]).filter(e => e);
    return convertedPreferredDay;
}

function parsePersonalInfo(configData: Config) {
    if (!configData.personalInfo.loadFromEnv) return configData;
    log.info('Loading personal info from environment variables.');
    const { FIRSTNAME, LASTNAME, DOB, EMAIL, LASTFOURSSN, PHONENUMBER } = process.env;
    if (!FIRSTNAME || !LASTNAME || !DOB || !EMAIL || !LASTFOURSSN) {
        log.error('Missing environment variables for personal info. Please refer to example.env file.');
        process.exit(1);
    }
    configData.personalInfo.firstName = FIRSTNAME;
    configData.personalInfo.lastName = LASTNAME;
    configData.personalInfo.dob = DOB;
    configData.personalInfo.email = EMAIL;
    configData.personalInfo.lastFourSSN = LASTFOURSSN;
    configData.personalInfo.phoneNumber = PHONENUMBER;
    return configData;
}
