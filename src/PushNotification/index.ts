import axios from 'axios';
import parseConfig from '../Config';
const config = parseConfig();

const pushNotification = async (message: string) => {
    await axios.post(`${config.appSettings.pushNotification.baseURL}/${config.appSettings.pushNotification.topicName}`, message, {
        headers: {
            Authorization: `Bearer ${config.appSettings.pushNotification.token}`,
            Title: 'DPS Scheduler',
        },
    });
};

export { pushNotification };
