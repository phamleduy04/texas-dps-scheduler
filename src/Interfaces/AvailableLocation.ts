interface BaseLocationPayload {
    PreferredDay: number;
    TypeId: number;
}

interface CityLocationPayload extends BaseLocationPayload {
    CityName: string;
    ZipCode: '';
}

interface ZipCodeLocationPayload extends BaseLocationPayload {
    ZipCode: string;
    CityName: '';
}

export type AvailableLocationPayload = CityLocationPayload | ZipCodeLocationPayload;

export interface AvailableLocationBase {
    Id: number;
    Address: string;
    Distance: number;
    Name: string;
    NextAvailableDate: string;
}

export type AvailableLocationResponse = (AvailableLocationBase & { ZipCode: string; CityName?: never }) | (AvailableLocationBase & { CityName: string; ZipCode?: never });
