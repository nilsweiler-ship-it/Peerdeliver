import React from 'react';
import { ViewStyle } from 'react-native';
import { MapHeader } from './MapHeader';

interface LatLng {
  lat: number;
  lng: number;
}
interface LiveMapProps {
  from?: LatLng | null;
  to?: LatLng | null;
  driver?: LatLng | null;
  height?: number;
  children?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Web fallback: react-native-maps has no first-class web support, and web uses
 * the stylized static map anyway. Renders the SVG MapHeader with the overlay.
 */
export function LiveMap({ height = 212, children, style }: LiveMapProps) {
  return (
    <MapHeader height={height} style={style}>
      {children}
    </MapHeader>
  );
}
