import { yellow, green, red } from 'colorette';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('America/Chicago');

const timeNow = () => dayjs().format('MM/DD/YYYY h:mm:ss');

const msg = (func: (message: string) => void, message: string) => func(`${yellow(`[${timeNow()}]`)} ${green(message)}`);

const error = (message = 'Unknown error', err?: unknown) => {
    console.error(`[${yellow(timeNow())}] ERROR: ${red(message)}`);
    if (err) console.error(err);
};

const info = (message: string) => msg(console.info, message);

// Development mode logging
// Use this CAREFULLY. Do not log sensitive info even in dev mode if possible.
const dev = (message: string) => (process.env.NODE_ENV === 'development' ? msg(console.info, `${yellow('DEBUG ->')} ${message}`) : null);

const warn = (message: string) => msg(console.warn, `${yellow('WARNING ->')} ${message}`);

export { error, info, warn, dev };
