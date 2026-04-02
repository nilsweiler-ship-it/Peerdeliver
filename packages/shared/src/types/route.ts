import { GeoPoint, PackageSize } from './delivery';
import { PublicUser } from './user';

export type RouteType = 'one_time' | 'recurring';

export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface DriverRoute {
  id: string;
  driverId: string;
  driver?: PublicUser;
  originAddress: string;
  originPoint: GeoPoint;
  destinationAddress: string;
  destinationPoint: GeoPoint;
  routeType: RouteType;
  departureTime: string;
  recurringDays?: DayOfWeek[];
  availableSize: PackageSize;
  maxDetourMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
