export interface HoldSlotPayload {
    DateOfBirth: string;
    FirstName: string;
    Last4Ssn: string;
    LastName: string;
    SlotId: number;
}

export interface HoldSlotResponse {
    SlotHeldSuccessfully: boolean;
    ErrorMessage?: string;
}
