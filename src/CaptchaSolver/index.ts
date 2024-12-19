import * as Capsolver from './Capsolver';

// 2captcha isn't stable
// import * as TwoCaptcha from './2Captcha';

import * as log from '../Log';
import parseConfig from '../Config';
const config = parseConfig();

const CreateCaptchaSolverTask = () => {
    switch (config.appSettings.captcha.solverOptions.solverService) {
        case 'capsolver':
            return Capsolver.CapSolverCreateTask(config.appSettings.captcha.solverOptions.solverApiToken);
        // case '2captcha':
        //     return TwoCaptcha.TwoCaptchaCreateTask(config.appSettings.captcha.solverOptions.solverApiToken);
        default:
            log.error('Unknown captcha solver service');
            throw new Error('Unknown captcha solver service');
    }
};

const GetCaptchaSolverResult = (taskId: string) => {
    switch (config.appSettings.captcha.solverOptions.solverService) {
        case 'capsolver':
            return Capsolver.CapSolverGetResult(taskId, config.appSettings.captcha.solverOptions.solverApiToken);
        // case '2captcha':
        //     return TwoCaptcha.TwoCaptchaGetResult(taskId, config.appSettings.captcha.solverOptions.solverApiToken);
        default:
            log.error('Unknown captcha solver service');
            throw new Error('Unknown captcha solver service');
    }
};

export { CreateCaptchaSolverTask, GetCaptchaSolverResult };
