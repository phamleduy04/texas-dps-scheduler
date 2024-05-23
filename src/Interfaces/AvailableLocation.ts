// This type request to AvailableLocation endpoints and check available locations
export interface AvailableLocationPayload {
    CityName: string;
    PreferredDay: number;
    TypeId: number;
    ZipCode: string;
}

// The response is more than this but i only use stuff I needed
export interface AvailableLocationResponse {
    Id: number;
    Address: string;
    Distance: number;
    Name: string;
    NextAvailableDate: string;
    ZipCode: string;
}
