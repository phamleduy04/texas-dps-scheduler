import { Pool } from 'undici';
import * as log from '../Log';
import type { CreateTaskResponse, GetResultResponse } from '../Interfaces/Captcha';

const captchaClient = new Pool('https://api.capsolver.com');

export const CapSolverCreateTask = async (clientKey: string) => {
    const getTaskID = await captchaClient.request({
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        path: '/createTask',
        body: JSON.stringify({
            clientKey,
            task: {
                type: 'ReCaptchaV3EnterpriseTaskProxyless',
                websiteURL: 'https://public.txdpsscheduler.com',
                websiteKey: '6LesF7oaAAAAAEvJD0hjmTUib8Q5PGjTo54U2ieP',
                pageAction: 'login',
            },
            // Refferal code for developer! You won't cost any money.
            appId: '38C7C3F9-63F7-4CAB-8C2A-771142941F88',
        }),
    });

    const taskIdRepsonse = (await getTaskID.body.json()) as CreateTaskResponse;
    if (getTaskID.statusCode !== 200) {
        log.error(`${taskIdRepsonse.errorCode}: ${taskIdRepsonse.errorDescription}`);
        throw new Error(`Got ${getTaskID.statusCode} status code`);
    }
    return taskIdRepsonse.taskId;
};

export const CapSolverGetResult = async (taskId: string, clientKey: string) => {
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
