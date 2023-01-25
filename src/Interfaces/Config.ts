import { z } from 'zod';

const configZod = z.object({
    personalInfo: z.object({
        firstName: z.string(),
        lastName: z.string(),
        dob: z.string(),
        email: z.string(),
        lastFourSSN: z.string(),
        phoneNumber: z.string().optional(),
        typeId: z.number().optional(),
    }),
    location: z.object({
        zipCode: z.string(),
        miles: z.number(),
        preferredDays: z.number(),
        sameDay: z.boolean(),
        daysAround: z.object({
            start: z.number(),
            end: z.number(),
        }),
    }),
    appSettings: z.object({
        cancelIfExist: z.boolean().default(false),
        interval: z.number().default(10000),
        webserver: z.boolean().default(false),
        headersTimeout: z.number().default(20000),
    }),
    webhook: z.object({
        enable: z.boolean().default(false),
        url: z.string().optional(),
        password: z.string().optional(),
        phoneNumber: z.string().optional(),
        sendMethod: z.union([z.literal('private-api'), z.literal('apple-script')]).default('apple-script'),
        phoneNumberType: z.union([z.literal('iMessage'), z.literal('SMS')]).default('SMS'),
    }),
});

type Config = z.infer<typeof configZod>;

export { Config, configZod };
