import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import MapView, { Marker, Polyline, UrlTile } from 'react-native-maps';
import { colors } from '../../theme';

interface LatLng {
  lat: number;
  lng: number;
}

interface LiveMapProps {
  from?: LatLng | null;
  to?: LatLng | null;
  /** Live driver position (marigold marker). */
  driver?: LatLng | null;
  height?: number;
  children?: React.ReactNode;
  style?: ViewStyle;
}

// Free official Swiss basemap (attribution required). Beautiful, but it covers
// ONLY Switzerland — outside the border every tile is empty, so the map renders
// as a blank pane. That looks like a broken feature rather than a coverage
// limit, and it makes testing from anywhere else impossible.
const SWISSTOPO_TILES =
  'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg';

// Fallback for coordinates outside Switzerland. Shlep only operates in CH, so
// this is for development and for the occasional cross-border route.
const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Rough Swiss bounding box, generous enough to include border areas. */
function insideSwitzerland(p: LatLng | null | undefined): boolean {
  if (!p) return false;
  return p.lat > 45.7 && p.lat < 47.9 && p.lng > 5.8 && p.lng < 10.6;
}

/**
 * Real map for tracking: Swisstopo tiles, moss origin / terracotta destination
 * markers, a dashed spruce route line, and a marigold live-driver marker.
 * `LiveMap.web.tsx` renders the stylized SVG fallback for web.
 */
export function LiveMap({ from, to, driver, height = 212, children, style }: LiveMapProps) {
  const ref = useRef<MapView>(null);
  const pts = [from, to, driver].filter(Boolean) as LatLng[];

  useEffect(() => {
    if (ref.current && pts.length >= 2) {
      ref.current.fitToCoordinates(
        pts.map((p) => ({ latitude: p.lat, longitude: p.lng })),
        { edgePadding: { top: 70, right: 70, bottom: 90, left: 70 }, animated: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from?.lat, from?.lng, to?.lat, to?.lng, driver?.lat, driver?.lng]);

  const center = from ?? to ?? { lat: 47.37, lng: 8.54 };
  // Any point outside CH means Swisstopo would render blank, so switch the
  // whole layer rather than showing half a map.
  const allSwiss = pts.length > 0 && pts.every(insideSwitzerland);
  const tiles = allSwiss ? SWISSTOPO_TILES : OSM_TILES;

  return (
    <View style={[{ height, overflow: 'hidden', backgroundColor: '#D8EBDF' }, style]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        <UrlTile urlTemplate={tiles} maximumZ={19} zIndex={-1} />

        {from && to && (
          <Polyline
            coordinates={[
              { latitude: from.lat, longitude: from.lng },
              { latitude: to.lat, longitude: to.lng },
            ]}
            strokeColor={colors.primary}
            strokeWidth={3}
            lineDashPattern={[2, 8]}
          />
        )}
        {from && (
          <Marker coordinate={{ latitude: from.lat, longitude: from.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.origin} />
          </Marker>
        )}
        {to && (
          <Marker coordinate={{ latitude: to.lat, longitude: to.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.dest} />
          </Marker>
        )}
        {driver && (
          <Marker coordinate={{ latitude: driver.lat, longitude: driver.lng }} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverHalo}>
              <View style={styles.driverDot} />
            </View>
          </Marker>
        )}
      </MapView>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  origin: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  dest: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: colors.destination,
  },
  driverHalo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(233,162,59,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.signal,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
});
