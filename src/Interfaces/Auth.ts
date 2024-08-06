export interface AuthPayload {
    UserName: string;
    RecaptchaToken: {
        Action: 'Login';
        Token: string;
    };
}
