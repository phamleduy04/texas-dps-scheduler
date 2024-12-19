import { request } from 'undici';
import parseConfig from '../Config';
const config = parseConfig();

const pushNotifcation = async (message: string) => {
    await request(`${config.appSettings.pushNotifcation.baseURL}/${config.appSettings.pushNotifcation.topicName}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.appSettings.pushNotifcation.token}`,
            Title: 'DPS Scheduler',
        },
        body: message,
    });
};

export { pushNotifcation };
