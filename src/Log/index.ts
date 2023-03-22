import { yellow, green, red } from 'colorette';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('America/Chicago');

const timeNow = () => dayjs().format('MM/DD/YYYY h:mm:ss');

const msg = (func: any, message: string) => func(`${yellow(`[${timeNow()}]`)} ${green(message)}`);

const error = (message = 'Unknown error', err?: Error) => {
    console.error(`[${yellow(timeNow())}] ERROR: ${red(message)}`);
    if (err) console.error(err);
};

const info = (message: string) => msg(console.info, message);

const warn = (message: string) => msg(console.warn, `${yellow('WARNING ->')} ${message}`);

export { error, info, warn };
