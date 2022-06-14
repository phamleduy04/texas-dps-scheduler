// This type request to AvaliableLocationDates endpoints and check avaliable dates on specific location

export interface AvaliableLocationDatesPayload {
    LocationId: number;
    PreferredDay: number;
    SameDay: boolean;
    StartDate?: null;
    TypeId: number;
}

export interface AvaliableLocationDatesResponse {
    MoreDatesAvailable: boolean;
    FirstAvailableDate: Date;
    LocationAvailabilityDates: LocationAvailabilityDates[];
}

interface LocationAvailabilityDates {
    LocationId: number;
    ServiceTypeId: number;
    AvailabilityDate: string;
    AvailableTimeSlots: AvaliableTimeSlots[];
}

export interface AvaliableTimeSlots {
    FormattedStartDateTime: string;
    SlotId: number;
    Duration: number;
    StartDateTime: string;
}