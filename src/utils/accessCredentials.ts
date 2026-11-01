export interface GeneratedAccessCredentials {
  login: string;
  password: string;
  ticket: string;
  expiresAt: string;
}

export interface CreateAccessRequest {
  name: string;
  roleInfo: string;
  branch: string;
  credentialTicket: string;
}
