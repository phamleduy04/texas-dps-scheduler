// This type request to AvaliableLocation endpoints and check avaliable locations
export interface AvaliableLocationPayload {
    CityName: string,
    PreferredDay: number,
    TypeId: number,
    ZipCode: string,
}

// The response is more than this but i only use stuff I needed
export interface AvaliableLocationResponse {
    Id: number,
    Address: string,
    Distance: number,
    Name: string,
    NextAvailableDate: string,
}

