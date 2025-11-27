import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl, { type LngLatBoundsLike, type Map } from 'mapbox-gl';
import { TripSegment } from '../../types/trip';
import { useMapboxToken } from '../../lib/useMapboxToken';

type TripPlannerMapProps = {
  tripName: string;
  segments: TripSegment[];
};

type StopPoint = {
  id: string;
  name: string;
  coordinates: [number, number];
};

const LINE_SOURCE_ID = 'trip-line';
const LINE_LAYER_ID = 'trip-line-layer';

const isValidCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const DEFAULT_VIEW: { center: [number, number]; zoom: number } = {
  center: [-98.5795, 39.8283],
  zoom: 2.5,
};

export const TripPlannerMap = ({ segments, tripName }: TripPlannerMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const { token, isLoading, error } = useMapboxToken();

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
      results.push({ id, name, coordinates: [lng, lat] });
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
    const coords: [number, number][] = [];

    segments.forEach((segment) => {
      const start = segment.startLocation;
      if (isValidCoordinate(start.lat) && isValidCoordinate(start.lng)) {
        coords.push([start.lng, start.lat]);
      }
      if (segment.endLocation && isValidCoordinate(segment.endLocation.lat) && isValidCoordinate(segment.endLocation.lng)) {
        coords.push([segment.endLocation.lng, segment.endLocation.lat]);
      }
    });

    return coords;
  }, [segments]);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: DEFAULT_VIEW.center,
      zoom: DEFAULT_VIEW.zoom,
      attributionControl: true,
    });

    const handleLoad = () => setMapReady(true);
    map.on('load', handleLoad);
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.off('load', handleLoad);
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    stops.forEach((stop) => {
      const marker = new mapboxgl.Marker({ color: '#0ea5e9' })
        .setLngLat(stop.coordinates)
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(`<strong>${stop.name}</strong>`))
        .addTo(map);
      markersRef.current.push(marker);
    });

    const hasLine = map.getSource(LINE_SOURCE_ID);
    if (lineCoordinates.length >= 2) {
      const geojson = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: lineCoordinates,
        },
      } as GeoJSON.Feature<GeoJSON.LineString>;

      if (hasLine) {
        const source = map.getSource(LINE_SOURCE_ID) as mapboxgl.GeoJSONSource;
        source.setData(geojson);
      } else {
        map.addSource(LINE_SOURCE_ID, {
          type: 'geojson',
          data: geojson,
        });
        map.addLayer({
          id: LINE_LAYER_ID,
          type: 'line',
          source: LINE_SOURCE_ID,
          paint: {
            'line-color': '#0ea5e9',
            'line-width': 3,
            'line-opacity': 0.85,
          },
        });
      }
    } else if (hasLine) {
      map.removeLayer(LINE_LAYER_ID);
      map.removeSource(LINE_SOURCE_ID);
    }

    if (stops.length > 0) {
      const bounds = stops.reduce<mapboxgl.LngLatBounds | null>((acc, stop) => {
        if (!acc) {
          return new mapboxgl.LngLatBounds(stop.coordinates, stop.coordinates);
        }
        return acc.extend(stop.coordinates);
      }, null);

      if (bounds) {
        map.fitBounds(bounds as LngLatBoundsLike, { padding: 60, maxZoom: 9, duration: 800 });
      }
    } else {
      map.easeTo({ center: DEFAULT_VIEW.center, zoom: DEFAULT_VIEW.zoom, duration: 500 });
    }
  }, [lineCoordinates, mapReady, stops]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        Loading map...
      </div>
    );
  }

  if (!token || error) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        <p className="font-semibold">Map unavailable.</p>
        <p className="mt-1 text-sm">Set VITE_MAPBOX_TOKEN in your environment to view the trip map.</p>
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
