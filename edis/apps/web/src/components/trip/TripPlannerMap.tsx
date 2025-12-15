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

type PartialStop = {
  id: string;
  name: string;
  coordinates?: google.maps.LatLngLiteral;
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
  const [geocodedStops, setGeocodedStops] = useState<Record<string, google.maps.LatLngLiteral>>({});
  const { googleMaps, isLoading, error } = useGoogleMapsApi();

  const stops = useMemo<PartialStop[]>(() => {
    const results: PartialStop[] = [];
    const seen = new Set<string>();

    const pushStop = (name: string, lat?: number, lng?: number, keyPrefix?: string) => {
      if (!name && (!isValidCoordinate(lat) || !isValidCoordinate(lng))) {
        return;
      }
      const id = keyPrefix ?? `${name}-${lat}-${lng}`;
      if (seen.has(id)) {
        return;
      }
      seen.add(id);
      const coordinates = isValidCoordinate(lat) && isValidCoordinate(lng) ? { lng, lat } : undefined;
      results.push({ id, name: name || 'Unnamed stop', coordinates });
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

  useEffect(() => {
    if (!googleMaps) {
      return;
    }

    const missingStops = stops.filter((stop) => !stop.coordinates && !geocodedStops[stop.id] && stop.name);
    if (missingStops.length === 0) {
      return;
    }

    let isCancelled = false;
    const geocoder = new googleMaps.maps.Geocoder();

    const geocodeStop = (stop: PartialStop) =>
      new Promise<{ id: string; coordinates: google.maps.LatLngLiteral } | null>((resolve) => {
        geocoder.geocode({ address: stop.name }, (results, status) => {
          if (isCancelled) {
            resolve(null);
            return;
          }

          if (status === 'OK' && results?.[0]?.geometry?.location) {
            const location = results[0].geometry.location;
            resolve({ id: stop.id, coordinates: { lat: location.lat(), lng: location.lng() } });
          } else {
            resolve(null);
          }
        });
      });

    (async () => {
      const resolved = await Promise.all(missingStops.map(geocodeStop));
      if (isCancelled) return;

      const updates = resolved.filter(Boolean) as { id: string; coordinates: google.maps.LatLngLiteral }[];
      if (updates.length > 0) {
        setGeocodedStops((prev) => {
          const next = { ...prev };
          updates.forEach((update) => {
            next[update.id] = update.coordinates;
          });
          return next;
        });
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [geocodedStops, googleMaps, stops]);

  const resolvedStops = useMemo<StopPoint[]>(() => {
    return stops
      .map((stop) => {
        const coordinates = stop.coordinates ?? geocodedStops[stop.id];
        if (!coordinates) return null;
        return { ...stop, coordinates } as StopPoint;
      })
      .filter(Boolean) as StopPoint[];
  }, [geocodedStops, stops]);

  const lineCoordinates = useMemo(() => {
    const coords: google.maps.LatLngLiteral[] = [];

    segments.forEach((segment) => {
      const startId = `${segment.id}-start`;
      const endId = `${segment.id}-end`;
      const start = segment.startLocation;
      const startCoordinates =
        (isValidCoordinate(start.lat) && isValidCoordinate(start.lng) && { lng: start.lng, lat: start.lat }) || geocodedStops[startId];

      if (startCoordinates) {
        coords.push(startCoordinates);
      }

      if (segment.endLocation) {
        const end = segment.endLocation;
        const endCoordinates =
          (isValidCoordinate(end.lat) && isValidCoordinate(end.lng) && { lng: end.lng, lat: end.lat }) || geocodedStops[endId];

        if (endCoordinates) {
          coords.push(endCoordinates);
        }
      }
    });

    return coords;
  }, [geocodedStops, segments]);

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

    resolvedStops.forEach((stop) => {
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

    if (resolvedStops.length > 0) {
      const bounds = new googleMaps.maps.LatLngBounds();
      resolvedStops.forEach((stop) => bounds.extend(stop.coordinates));
      map.fitBounds(bounds, 60);
    } else {
      map.setOptions({ center: DEFAULT_VIEW.center, zoom: DEFAULT_VIEW.zoom });
    }
  }, [lineCoordinates, mapReady, resolvedStops, googleMaps]);

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
