import axios from 'axios';
import * as log from '../Log';
import type { CreateTaskResponse, GetResultResponse } from '../Interfaces/Captcha';

const captchaClient = axios.create({ baseURL: 'https://api.capsolver.com' });

export const CapSolverCreateTask = async (clientKey: string) => {
    const getTaskID = await captchaClient.post(
        '/createTask',
        {
            clientKey,
            task: {
                type: 'ReCaptchaV3EnterpriseTaskProxyless',
                websiteURL: 'https://public.txdpsscheduler.com',
                websiteKey: '6LesF7oaAAAAAEvJD0hjmTUib8Q5PGjTo54U2ieP',
                pageAction: 'login',
            },
            // Refferal code for developer! You won't cost any money.
            appId: '38C7C3F9-63F7-4CAB-8C2A-771142941F88',
        },
        {
            headers: {
                'Content-Type': 'application/json',
            },
            validateStatus: () => true,
        },
    );

    const taskIdRepsonse = getTaskID.data as CreateTaskResponse;
    if (getTaskID.status !== 200) {
        log.error(`${taskIdRepsonse.errorCode}: ${taskIdRepsonse.errorDescription}`);
        throw new Error(`Got ${getTaskID.status} status code`);
    }
    return taskIdRepsonse.taskId;
};

export const CapSolverGetResult = async (taskId: string, clientKey: string) => {
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
