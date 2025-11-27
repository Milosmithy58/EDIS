import { useEffect, useMemo, useRef, useState } from 'react';
import { TripSegment } from '../../types/trip';
import { useGoogleMapsApi } from '../../lib/useGoogleMapsApi';

type TripPlannerMapProps = {
  tripName: string;
  segments: TripSegment[];
};

type StopPoint = {
  id: string;
  name: string;
  coordinates: google.maps.LatLngLiteral;
};

const DEFAULT_VIEW = { center: { lng: -98.5795, lat: 39.8283 }, zoom: 2.5 } as const;
const LINE_STROKE = '#0ea5e9';

const isValidCoordinate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const TripPlannerMap = ({ segments, tripName }: TripPlannerMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const { googleMaps, isLoading, error } = useGoogleMapsApi();

  const stops = useMemo<StopPoint[]>(() => {
    const results: StopPoint[] = [];
    const seen = new Set<string>();

    const pushStop = (name: string, lat?: number, lng?: number, keyPrefix?: string) => {
      if (!isValidCoordinate(lat) || !isValidCoordinate(lng)) {
        return;
      }
      const id = `${keyPrefix ?? name}-${lat}-${lng}`;
      if (seen.has(id)) {
        return;
      }
      seen.add(id);
      results.push({ id, name, coordinates: { lng, lat } });
    };

    segments.forEach((segment, index) => {
      const start = segment.startLocation;
      pushStop(start.name || `Start ${index + 1}`, start.lat, start.lng, `${segment.id}-start`);
      if (segment.endLocation) {
        pushStop(
          segment.endLocation.name || `End ${index + 1}`,
          segment.endLocation.lat,
          segment.endLocation.lng,
          `${segment.id}-end`
        );
      }
    });

    return results;
  }, [segments]);

  const lineCoordinates = useMemo(() => {
    const coords: google.maps.LatLngLiteral[] = [];

    segments.forEach((segment) => {
      const start = segment.startLocation;
      if (isValidCoordinate(start.lat) && isValidCoordinate(start.lng)) {
        coords.push({ lng: start.lng, lat: start.lat });
      }
      if (segment.endLocation && isValidCoordinate(segment.endLocation.lat) && isValidCoordinate(segment.endLocation.lng)) {
        coords.push({ lng: segment.endLocation.lng, lat: segment.endLocation.lat });
      }
    });

    return coords;
  }, [segments]);

  useEffect(() => {
    if (!googleMaps || !containerRef.current || mapRef.current) {
      return;
    }

    const map = new googleMaps.maps.Map(containerRef.current, {
      center: DEFAULT_VIEW.center,
      zoom: DEFAULT_VIEW.zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true
    });

    mapRef.current = map;
    setMapReady(true);

    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
      mapRef.current = null;
      setMapReady(false);
    };
  }, [googleMaps]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !googleMaps) {
      return;
    }

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    stops.forEach((stop) => {
      const marker = new googleMaps.maps.Marker({
        position: stop.coordinates,
        map,
        title: stop.name,
        icon: {
          path: googleMaps.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: LINE_STROKE,
          fillOpacity: 1,
          strokeColor: '#0a6fa4',
          strokeWeight: 2
        }
      });

      const info = new googleMaps.maps.InfoWindow({ content: `<strong>${stop.name}</strong>` });
      marker.addListener('click', () => info.open({ anchor: marker, map }));
      markersRef.current.push(marker);
    });

    if (lineCoordinates.length >= 2) {
      if (!polylineRef.current) {
        polylineRef.current = new googleMaps.maps.Polyline({
          strokeColor: LINE_STROKE,
          strokeOpacity: 0.85,
          strokeWeight: 3
        });
      }
      polylineRef.current.setPath(lineCoordinates);
      polylineRef.current.setMap(map);
    } else if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    if (stops.length > 0) {
      const bounds = new googleMaps.maps.LatLngBounds();
      stops.forEach((stop) => bounds.extend(stop.coordinates));
      map.fitBounds(bounds, { padding: 60 });
    } else {
      map.setOptions({ center: DEFAULT_VIEW.center, zoom: DEFAULT_VIEW.zoom });
    }
  }, [lineCoordinates, mapReady, stops, googleMaps]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        Loading map...
      </div>
    );
  }

  if (!googleMaps || error) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        <p className="font-semibold">Map unavailable.</p>
        <p className="mt-1 text-sm">Set VITE_GOOGLE_MAPS_API_KEY in your environment to view the trip map.</p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[420px] overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-700">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Trip route</p>
          <p className="font-semibold">{tripName || 'Untitled trip'}</p>
        </div>
        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-900/40 dark:text-sky-200">
          {stops.length} stop{stops.length === 1 ? '' : 's'}
        </span>
      </div>
      <div ref={containerRef} className="h-[500px] w-full" aria-label="Trip map" />
    </div>
  );
};

export default TripPlannerMap;
