export interface AuthPayload {
    UserName: string;
    RecaptchaToken: {
        Action: 'login';
        Token: string;
    };
    CellPhone: string;
    Email: string;
    IsEmail: true;
    IsMobile: false;
    UserDetails: {
        CardNumber: string;
        DateOfBirth: string;
        FirstName: string;
        LastName: string;
        LastFourDigitsSsn: string;
    };
}
