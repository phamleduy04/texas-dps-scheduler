import { z } from 'zod';

const checkStartLowerThanEnd = data => data.start < data.end;

const configZod = z.object({
    personalInfo: z.object({
        loadFromEnv: z.boolean().default(false),
        firstName: z.string(),
        lastName: z.string(),
        dob: z.string(),
        email: z.string(),
        lastFourSSN: z.string(),
        phoneNumber: z.string().optional().nullable(),
        typeId: z.number().optional(),
    }),
    location: z.object({
        cityName: z.string().array().optional(),
        zipCode: z.string().array().optional(),
        pickDPSLocation: z.boolean().default(false),
        miles: z.number(),
        preferredDays: z.number().array(),
        sameDay: z.boolean(),
        daysAround: z
            .object({
                startDate: z.string(),
                start: z.number(),
                end: z.number(),
            })
            .refine(checkStartLowerThanEnd, { message: 'Start number must be lower than end number' }),
        timesAround: z
            .object({
                start: z.number(),
                end: z.number(),
            })
            .refine(checkStartLowerThanEnd, { message: 'Start number must be lower than end number' }),
    }),
    appSettings: z
        .object({
            authToken: z.string().default(''),
            cancelIfExist: z.boolean().default(false),
            interval: z.number().default(10000),
            webserver: z.boolean().default(false),
            headersTimeout: z.number().default(20000),
            maxRetry: z.number().default(3),
            captcha: z
                .object({
                    strategy: z.enum(['browser', 'solver']).default('browser'),
                    solverOptions: z
                        .object({
                            solverService: z.enum(['2captcha', 'capsolver']).optional(),
                            solverApiToken: z.string().optional(),
                        })
                        .optional()
                        .nullable(),
                })
                .optional()
                .nullable()
                .refine(
                    data => {
                        if (data.strategy === 'browser') return true;
                        return typeof data.solverOptions.solverService === 'string' && typeof data.solverOptions.solverApiToken === 'string';
                    },
                    {
                        message: 'If you want to use solver, please provide all required fields',
                    },
                ),
            pushNotifcation: z
                .object({
                    enabled: z.boolean().default(false),
                    baseURL: z.string().optional(),
                    topicName: z.string().optional(),
                    token: z.string().optional(),
                })
                .refine(
                    data => {
                        if (!data.enabled) return true;
                        return typeof data.baseURL === 'string' && typeof data.topicName === 'string' && typeof data.token === 'string';
                    },
                    {
                        message: 'If you want to enable push notification, please provide all required fields',
                    },
                ),
        })
        .refine(
            data => {
                return data.authToken.length === 0 || data.captcha;
            },
            {
                message: 'Auth token is required if no solver is used and vice versa',
            },
        ),
});

type Config = z.infer<typeof configZod>;

export { Config, configZod };
