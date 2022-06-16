export interface BookSlotPayload {
    AdaRequired: boolean;
    BookingDateTime: string;
    BookingDuration: number;
    CardNumber: string;
    CellPhone: string;
    DateOfBirth: string;
    Email: string;
    FirstName: string;
    HomePhone: string;
    Last4Ssn: string;
    LastName: string;
    ResponseId: number;
    SendSms: boolean;
    ServiceTypeId: number;
    SiteId: number;
    SpanishLanguage: 'N' | 'Y';
}

// Real response have more fields, but we don't need them
export interface BookSlotResponse {
    Booking: {
        BookingId: number;
        ConfirmationNumber: string;
        SiteName: string;
    };
}
