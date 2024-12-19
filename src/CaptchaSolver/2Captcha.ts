import { Pool } from 'undici';
import * as log from '../Log';
import type { CreateTaskResponse, GetResultResponse } from '../Interfaces/Captcha';

const captchaClient = new Pool('https://api.2captcha.com');

export const TwoCaptchaCreateTask = async (clientKey: string) => {
    const getTaskID = await captchaClient.request({
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        path: '/createTask',
        body: JSON.stringify({
            clientKey,
            task: {
                type: 'RecaptchaV3TaskProxyless',
                websiteURL: 'https://public.txdpsscheduler.com',
                websiteKey: '6LesF7oaAAAAAEvJD0hjmTUib8Q5PGjTo54U2ieP',
                minScore: '0.9',
                isEnterprise: true,
                pageAction: 'login',
            },
        }),
    });

    const taskIdRepsonse = (await getTaskID.body.json()) as CreateTaskResponse;
    if (getTaskID.statusCode !== 200) {
        log.error(`${taskIdRepsonse.errorId}: ${taskIdRepsonse.errorDescription ?? 'No error description'} `);
        throw new Error(`Got ${getTaskID.statusCode} status code`);
    }
    return taskIdRepsonse.taskId;
};

export const TwoCaptchaGetResult = async (taskId: string, clientKey: string) => {
    const captchaResult = await captchaClient.request({
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        path: '/getTaskResult',
        body: JSON.stringify({
            clientKey,
            taskId,
        }),
    });
    const captchaResultResponse = (await captchaResult.body.json()) as GetResultResponse;
    return captchaResultResponse;
};
