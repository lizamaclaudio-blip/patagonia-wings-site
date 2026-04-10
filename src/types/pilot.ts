export type PilotOperationalStatus = "Operational" | "Pending Review" | "Restricted";
export type CertificationStatus = "Active" | "Pending" | "Expired";
export type RatingStatus = "Active" | "Training" | "Locked";

export interface PilotProfile {
  firstName: string;
  lastName: string;
  callsign: string;
  email: string;
  country: string;
  baseHub: string;
  mainSimulator: string;
  simbriefUsername: string;
  vatsimId: string;
  ivaoId: string;
  status: PilotOperationalStatus;
  totalHours: number;
  favoriteAirports: string[];
  notes: string;
}

export interface PilotCertification {
  code: string;
  name: string;
  category: string;
  status: CertificationStatus;
  issuedAt: string;
  expiresAt: string;
}

export interface PilotAircraftRating {
  code: string;
  name: string;
  family: string;
  status: RatingStatus;
}