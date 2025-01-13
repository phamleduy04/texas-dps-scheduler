import axios from 'axios';
import * as log from '../Log';
import type { CreateTaskResponse, GetResultResponse } from '../Interfaces/Captcha';

const captchaClient = axios.create({ baseURL: 'https://api.2captcha.com' });

export const TwoCaptchaCreateTask = async (clientKey: string) => {
    const getTaskID = await captchaClient.post(
        '/createTask',
        {
            clientKey,
            task: {
                type: 'RecaptchaV3TaskProxyless',
                websiteURL: 'https://public.txdpsscheduler.com',
                websiteKey: '6LesF7oaAAAAAEvJD0hjmTUib8Q5PGjTo54U2ieP',
                minScore: '0.9',
                isEnterprise: true,
                pageAction: 'login',
            },
        },
        {
            headers: { 'Content-Type': 'application/json' },
            validateStatus: () => true,
        },
    );

    const taskIdRepsonse = getTaskID.data as CreateTaskResponse;
    if (getTaskID.status !== 200) {
        log.error(`${taskIdRepsonse.errorId}: ${taskIdRepsonse.errorDescription ?? 'No error description'} `);
        throw new Error(`Got ${getTaskID.status} status code`);
    }
    return taskIdRepsonse.taskId;
};

export const TwoCaptchaGetResult = async (taskId: string, clientKey: string) => {
    const captchaResult = await captchaClient.post(
        '/getTaskResult',
        {
            clientKey,
            taskId,
        },
        {
            headers: {
                'Content-Type': 'application/json',
            },
        },
    );
    const captchaResultResponse = captchaResult.data as GetResultResponse;
    return captchaResultResponse;
};
