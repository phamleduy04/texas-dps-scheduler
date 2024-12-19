export interface AuthPayload {
    UserName: string;
    RecaptchaToken: {
        Action: 'login';
        Token: string;
    };
}
