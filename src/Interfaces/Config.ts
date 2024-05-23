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
        zipCode: z.string().array(),
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
    appSettings: z.object({
        cancelIfExist: z.boolean().default(false),
        interval: z.number().default(10000),
        webserver: z.boolean().default(false),
        headersTimeout: z.number().default(20000),
        maxRetry: z.number().default(3),
    }),
});

type Config = z.infer<typeof configZod>;

export { Config, configZod };
