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
    // tried with multiple number and the only thing that changed was the RequiredDocuments field
    ResponseId: number;
    SendSms: boolean;
    ServiceTypeId: number;
    // not sure about this
    SiteId: number;
    SpanishLanguage: 'N' | 'Y';
}
