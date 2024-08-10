// Base interface for the request payload
interface BaseLocationPayload {
    PreferredDay: number;
    TypeId: number;
}

// Payload for when the CityName is provided
interface CityLocationPayload extends BaseLocationPayload {
    CityName: string;
    ZipCode: ""; // Ensures ZipCode is an empty string if CityName is provided
}

// Payload for when the ZipCode is provided
interface ZipCodeLocationPayload extends BaseLocationPayload {
    ZipCode: string;
    CityName: ""; // Ensures CityName is an empty string if ZipCode is provided
}

// Union type for the payload that allows either CityName or ZipCode
export type AvailableLocationPayload = CityLocationPayload | ZipCodeLocationPayload;

// Base interface for the location response
export interface AvailableLocationBase {
    Id: number;
    Address: string;
    Distance: number;
    Name: string;
    NextAvailableDate: string;
}

// Response type for when the CityName or ZipCode is provided
export type AvailableLocationResponse = 
    | (AvailableLocationBase & { ZipCode: string; CityName?: never })
    | (AvailableLocationBase & { CityName: string; ZipCode?: never });
