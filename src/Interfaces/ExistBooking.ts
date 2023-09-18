export interface ExistBookingPayload {
    FirstName: string;
    LastName: string;
    DateOfBirth: string;
    LastFourDigitsSsn: string;
}

// Real response have more fields, but we don't need them
export interface ExistBookingResponse {
    FirstName: string;
    LastName: string;
    Last4Ssn: string;
    DateOfBirth: string;
    ConfirmationNumber: string;
    BookingDateTime: string;
    SiteName: string;
    ServiceTypeId: number;
}
