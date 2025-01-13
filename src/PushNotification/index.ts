import axios from 'axios';
import parseConfig from '../Config';
const config = parseConfig();

const pushNotifcation = async (message: string) => {
    await axios.post(`${config.appSettings.pushNotifcation.baseURL}/${config.appSettings.pushNotifcation.topicName}`, message, {
        headers: {
            Authorization: `Bearer ${config.appSettings.pushNotifcation.token}`,
            Title: 'DPS Scheduler',
        },
    });
};

export { pushNotifcation };
