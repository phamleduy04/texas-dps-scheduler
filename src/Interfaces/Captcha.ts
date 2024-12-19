export interface CreateTaskResponse {
    taskId: string;
    errorId: number;
    errorCode: string;
    errorDescription: string;
}

export interface GetResultResponse {
    errorId: number;
    status: string;
    solution: {
        gRecaptchaResponse: string;
        token: string;
    };
    cost: string;
    ip: string;
    createTime: number;
}
