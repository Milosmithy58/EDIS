export type TripSegmentType = 'flight' | 'train' | 'drive' | 'hotel' | 'stop';

export type TripLocation = {
  name: string;
  lat?: number;
  lng?: number;
};

export type TripSegmentDetails = {
  airline?: string;
  flightNumber?: string;
  trainOperator?: string;
  trainNumber?: string;
  hotelName?: string;
  confirmationNumber?: string;
  notes?: string;
};

export type TripSegment = {
  id: string;
  type: TripSegmentType;
  label: string;
  startLocation: TripLocation;
  endLocation?: TripLocation;
  startTime?: string;
  endTime?: string;
  details?: TripSegmentDetails;
};

export type TripPlan = {
  id: string;
  name: string;
  segments: TripSegment[];
};
