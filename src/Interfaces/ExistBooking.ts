export interface ExistBookingPayload {
    FirstName: string;
    LastName: string;
    DateOfBirth: string;
    LastFourDigitsSsn: string;
}

// Real response have more fields, but we don't need them
export interface ExistBookingResponse {
    ConfirmationNumber: string;
    BookingDateTime: string;
    SiteName: string;
}
