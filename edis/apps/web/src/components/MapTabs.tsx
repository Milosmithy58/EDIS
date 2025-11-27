import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGoogleMapsApi } from '../lib/useGoogleMapsApi';

type TabKey = 'none' | 'traffic' | 'poi' | 'transit';

type MapTabsProps = {
  initialLng?: number;
  initialLat?: number;
  initialZoom?: number;
  heightClass?: string;
};

const TAB_ITEMS: { key: Exclude<TabKey, 'none'>; label: string }[] = [
  { key: 'traffic', label: 'Traffic' },
  { key: 'poi', label: 'POI' },
  { key: 'transit', label: 'Transit' }
];

const DEFAULT_CENTER = { lng: -0.1276, lat: 51.5072 };

export default function MapTabs({
  initialLng = DEFAULT_CENTER.lng,
  initialLat = DEFAULT_CENTER.lat,
  initialZoom = 10,
  heightClass = 'h-[500px]'
}: MapTabsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const transitLayerRef = useRef<google.maps.TransitLayer | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const poiMarkersRef = useRef<google.maps.Marker[]>([]);

  const [activeTab, setActiveTab] = useState<TabKey>('none');

  const { googleMaps, isLoading, error } = useGoogleMapsApi();
  const center = useMemo(() => ({ lng: initialLng, lat: initialLat }), [initialLng, initialLat]);

  useEffect(() => {
    if (!googleMaps || !containerRef.current || mapRef.current) {
      return;
    }

    const map = new googleMaps.maps.Map(containerRef.current, {
      center,
      zoom: initialZoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true
    });

    mapRef.current = map;

    return () => {
      mapRef.current = null;
      trafficLayerRef.current = null;
      transitLayerRef.current = null;
      placesServiceRef.current = null;
      poiMarkersRef.current.forEach((marker) => marker.setMap(null));
      poiMarkersRef.current = [];
    };
  }, [center, googleMaps, initialZoom]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setOptions({ center, zoom: initialZoom });
  }, [center, initialZoom]);

  const hideTraffic = useCallback(() => {
    if (trafficLayerRef.current) {
      trafficLayerRef.current.setMap(null);
    }
  }, []);

  const hideTransit = useCallback(() => {
    if (transitLayerRef.current) {
      transitLayerRef.current.setMap(null);
    }
  }, []);

  const clearPoiMarkers = useCallback(() => {
    poiMarkersRef.current.forEach((marker) => marker.setMap(null));
    poiMarkersRef.current = [];
  }, []);

  const hidePoi = useCallback(() => {
    clearPoiMarkers();
  }, [clearPoiMarkers]);

  const showTraffic = useCallback(() => {
    const map = mapRef.current;
    if (!map || !googleMaps) return;

    if (!trafficLayerRef.current) {
      trafficLayerRef.current = new googleMaps.maps.TrafficLayer();
    }

    trafficLayerRef.current.setMap(map);
  }, [googleMaps]);

  const showTransit = useCallback(() => {
    const map = mapRef.current;
    if (!map || !googleMaps) return;

    if (!transitLayerRef.current) {
      transitLayerRef.current = new googleMaps.maps.TransitLayer();
    }

    transitLayerRef.current.setMap(map);
  }, [googleMaps]);

  const showPoi = useCallback(() => {
    const map = mapRef.current;
    if (!map || !googleMaps) return;

    if (!placesServiceRef.current) {
      placesServiceRef.current = new googleMaps.maps.places.PlacesService(map);
    }

    const center = map.getCenter();
    if (!center) return;

    placesServiceRef.current.nearbySearch(
      { location: center, radius: 3000, type: 'point_of_interest', keyword: 'popular' },
      (results, status) => {
        clearPoiMarkers();
        if (status !== googleMaps.maps.places.PlacesServiceStatus.OK || !results) {
          return;
        }

        results.slice(0, 20).forEach((place) => {
          if (!place.geometry?.location) return;
          const marker = new googleMaps.maps.Marker({
            position: place.geometry.location,
            map,
            title: place.name ?? 'Point of interest'
          });

          if (place.name) {
            const info = new googleMaps.maps.InfoWindow({ content: `<strong>${place.name}</strong>` });
            marker.addListener('click', () => info.open({ anchor: marker, map }));
          }

          poiMarkersRef.current.push(marker);
        });
      }
    );
  }, [clearPoiMarkers, googleMaps]);

  useEffect(() => {
    if (!mapRef.current) return;

    switch (activeTab) {
      case 'traffic':
        hideTransit();
        hidePoi();
        showTraffic();
        break;
      case 'poi':
        hideTraffic();
        hideTransit();
        showPoi();
        break;
      case 'transit':
        hideTraffic();
        hidePoi();
        showTransit();
        break;
      default:
        hideTraffic();
        hideTransit();
        hidePoi();
        break;
    }
  }, [activeTab, hidePoi, hideTraffic, hideTransit, showPoi, showTraffic, showTransit]);

  const handleTabClick = (key: Exclude<TabKey, 'none'>) => {
    setActiveTab((prev) => (prev === key ? 'none' : key));
  };

  const mapUnavailable = !googleMaps && !isLoading;

  return (
    <div className="w-full">
      <div className="flex gap-2 mb-3" role="tablist" aria-label="Map overlays">
        {TAB_ITEMS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className={`px-3 py-2 rounded-2xl border shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${
                isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'
              } disabled:cursor-not-allowed disabled:opacity-60`}
              onClick={() => handleTabClick(tab.key)}
              aria-pressed={isActive}
              aria-disabled={mapUnavailable}
              disabled={mapUnavailable}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-slate-200 bg-white`} aria-label="Interactive map">
        <div ref={containerRef} className="h-full w-full" />
        {mapUnavailable ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 p-6 text-center text-sm text-red-600">
            Map unavailable. Provide a VITE_GOOGLE_MAPS_API_KEY to enable maps.
            {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
