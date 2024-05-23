// This type request to AvailableLocationDates endpoints and check available dates on specific location

export interface AvailableLocationDatesPayload {
    LocationId: number;
    PreferredDay: number;
    SameDay: boolean;
    StartDate?: null;
    TypeId: number;
}

export interface AvailableLocationDatesResponse {
    MoreDatesAvailable: boolean;
    FirstAvailableDate: Date;
    LocationAvailabilityDates: LocationAvailabilityDates[];
}

interface LocationAvailabilityDates {
    LocationId: number;
    ServiceTypeId: number;
    AvailabilityDate: string;
    AvailableTimeSlots: AvailableTimeSlots[];
}

export interface AvailableTimeSlots {
    FormattedStartDateTime: string;
    SlotId: number;
    Duration: number;
    StartDateTime: string;
}
