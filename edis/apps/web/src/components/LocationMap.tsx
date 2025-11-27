import { useEffect, useMemo, useRef, useState } from 'react';
import type { GeoContext } from './LocationSearch';
import { useGoogleMapsApi } from '../lib/useGoogleMapsApi';

type DatasetKey = 'traffic' | 'poi' | 'transit';

type DatasetConfig = {
  title: string;
  description: string;
};

const DATASET_CONFIGS: Record<DatasetKey, DatasetConfig> = {
  traffic: {
    title: 'Traffic',
    description: 'View live traffic congestion from Google Maps.',
  },
  poi: {
    title: 'Points of Interest',
    description: 'Discover nearby popular places using Google Places.',
  },
  transit: {
    title: 'Public Transit',
    description: 'Visualize transit coverage with Google transit overlays.',
  },
};

type LocationMapProps = {
  geo: GeoContext | null;
};

const DATASET_KEYS: DatasetKey[] = ['traffic', 'poi', 'transit'];
const MAP_ZOOM_LEVEL = 12;

const LocationMap = ({ geo }: LocationMapProps) => {
  const [activeLayer, setActiveLayer] = useState<DatasetKey | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const transitLayerRef = useRef<google.maps.TransitLayer | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const poiMarkersRef = useRef<google.maps.Marker[]>([]);
  const { googleMaps, isLoading, error } = useGoogleMapsApi();

  useEffect(() => {
    if (!geo) {
      mapRef.current = null;
      return;
    }
  }, [geo]);

  useEffect(() => {
    if (!geo || !googleMaps || !mapContainerRef.current || mapRef.current) {
      return;
    }

    mapRef.current = new googleMaps.maps.Map(mapContainerRef.current, {
      center: { lat: geo.lat, lng: geo.lon },
      zoom: MAP_ZOOM_LEVEL,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });
  }, [geo, googleMaps]);

  useEffect(() => {
    if (!geo || !mapRef.current) return;
    mapRef.current.setOptions({ center: { lat: geo.lat, lng: geo.lon }, zoom: MAP_ZOOM_LEVEL });
  }, [geo]);

  const clearPoiMarkers = () => {
    poiMarkersRef.current.forEach((marker) => marker.setMap(null));
    poiMarkersRef.current = [];
  };

  const resetLayers = () => {
    trafficLayerRef.current?.setMap(null);
    transitLayerRef.current?.setMap(null);
    clearPoiMarkers();
  };

  const applyDataset = (key: DatasetKey) => {
    const map = mapRef.current;
    if (!map || !googleMaps || !geo) return;

    resetLayers();

    if (key === 'traffic') {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new googleMaps.maps.TrafficLayer();
      }
      trafficLayerRef.current.setMap(map);
      return;
    }

    if (key === 'transit') {
      if (!transitLayerRef.current) {
        transitLayerRef.current = new googleMaps.maps.TransitLayer();
      }
      transitLayerRef.current.setMap(map);
      return;
    }

    if (!placesServiceRef.current) {
      placesServiceRef.current = new googleMaps.maps.places.PlacesService(map);
    }

    const location = new googleMaps.maps.LatLng(geo.lat, geo.lon);
    placesServiceRef.current.nearbySearch({ location, radius: 3000, type: 'point_of_interest' }, (results, status) => {
      clearPoiMarkers();
      if (status !== googleMaps.maps.places.PlacesServiceStatus.OK || !results) {
        return;
      }
      results.slice(0, 20).forEach((place) => {
        if (!place.geometry?.location) return;
        const marker = new googleMaps.maps.Marker({
          position: place.geometry.location,
          title: place.name ?? 'Place of interest',
          map,
        });
        if (place.name) {
          const info = new googleMaps.maps.InfoWindow({ content: `<strong>${place.name}</strong>` });
          marker.addListener('click', () => info.open({ anchor: marker, map }));
        }
        poiMarkersRef.current.push(marker);
      });
    });
  };

  useEffect(() => {
    if (!activeLayer) {
      resetLayers();
      return;
    }
    applyDataset(activeLayer);
  }, [activeLayer]);

  const renderContent = () => {
    if (!geo) {
      return (
        <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-300">
          Search for a place to preview it on the map.
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-300">Loading map...</div>
      );
    }

    if (!googleMaps || error) {
      return (
        <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-300">
          Google Maps API key is not configured. Set <code>VITE_GOOGLE_MAPS_API_KEY</code> to enable the interactive map.
        </div>
      );
    }

    if (!activeLayer) {
      return (
        <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-300">
          Select a layer above to load the Google Maps visualization.
        </div>
      );
    }

    const config = DATASET_CONFIGS[activeLayer];

    return (
      <div className="relative">
        <div ref={mapContainerRef} className="h-[24rem] w-full" aria-label={`${config.title} map preview`} />
        <div className="pointer-events-none absolute bottom-4 left-4 max-w-xs rounded-md bg-white/90 p-3 text-xs text-slate-700 shadow-md dark:bg-slate-900/90 dark:text-slate-200">
          {config.description}
        </div>
      </div>
    );
  };

  const buttons = useMemo(
    () =>
      DATASET_KEYS.map((key) => {
        const config = DATASET_CONFIGS[key];
        const isActive = activeLayer === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setActiveLayer(key)}
            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 transition ${
              isActive
                ? 'border-sky-600 bg-sky-600 text-white hover:bg-sky-700 dark:border-sky-500 dark:bg-sky-500'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
            aria-pressed={isActive}
          >
            {config.title}
          </button>
        );
      }),
    [activeLayer]
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
        {buttons}
      </div>
      {renderContent()}
    </div>
  );
};

export default LocationMap;
