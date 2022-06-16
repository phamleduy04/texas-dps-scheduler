export interface webhookPayload {
    chatGuid: string;
    tempGuild: string;
    message: string;
    method: 'private-api' | 'apple-script';
    subject: string;
    effectId: string;
    selectedMessageGuild: string;
}
