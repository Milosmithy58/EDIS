import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

const SRC_TRAFFIC = 'src-traffic';
const LYR_TRAFFIC = 'lyr-traffic-flow';

const SRC_STREETS = 'src-streets';
const LYR_POI = 'lyr-poi-labels';
const LYR_TRANSIT_STOPS = 'lyr-transit-stops-fallback';
const LYR_RAIL_MAJOR = 'lyr-rail-major-fallback';
const LYR_RAIL_MINOR = 'lyr-rail-minor-fallback';

const SRC_TRANSIT = 'src-transit-v2';
const LYR_TRANSIT_LINES = 'lyr-transit-lines';

type TabKey = 'none' | 'traffic' | 'poi' | 'transit';

type MapboxTabsProps = {
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

function hasSource(map: mapboxgl.Map, id: string) {
  try {
    return Boolean(map.getSource(id));
  } catch (error) {
    console.error('Failed to read map source', error);
    return false;
  }
}

function hasLayer(map: mapboxgl.Map, id: string) {
  try {
    return Boolean(map.getLayer(id));
  } catch (error) {
    console.error('Failed to read map layer', error);
    return false;
  }
}

function safeRemoveLayer(map: mapboxgl.Map, id: string) {
  if (hasLayer(map, id)) {
    map.removeLayer(id);
  }
}

function safeRemoveSource(map: mapboxgl.Map, id: string) {
  if (hasSource(map, id)) {
    map.removeSource(id);
  }
}

export default function MapboxTabs({
  initialLng = -0.1276,
  initialLat = 51.5072,
  initialZoom = 10,
  heightClass = 'h-[500px]'
}: MapboxTabsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('none');
  const [mapLoaded, setMapLoaded] = useState(false);
  const tokenMissing = !MAPBOX_TOKEN;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    if (tokenMissing) {
      console.error('Mapbox access token not configured. Set VITE_MAPBOX_TOKEN.');
      return;
    }

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [initialLng, initialLat],
      zoom: initialZoom,
      attributionControl: true
    });

    const handleLoad = () => setMapLoaded(true);

    map.on('load', handleLoad);
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    mapRef.current = map;

    return () => {
      map.off('load', handleLoad);
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [initialLat, initialLng, initialZoom, tokenMissing]);

  const hideTraffic = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    safeRemoveLayer(map, LYR_TRAFFIC);
    safeRemoveSource(map, SRC_TRAFFIC);
  }, []);

  const hidePOI = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    [LYR_POI, LYR_TRANSIT_STOPS, LYR_RAIL_MAJOR, LYR_RAIL_MINOR].forEach((layerId) => {
      safeRemoveLayer(map, layerId);
    });
    safeRemoveSource(map, SRC_STREETS);
  }, []);

  const hideTransit = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    safeRemoveLayer(map, LYR_TRANSIT_LINES);
    [LYR_TRANSIT_STOPS, LYR_RAIL_MAJOR, LYR_RAIL_MINOR].forEach((layerId) => {
      safeRemoveLayer(map, layerId);
    });
    safeRemoveSource(map, SRC_TRANSIT);
    safeRemoveSource(map, SRC_STREETS);
  }, []);

  const showTraffic = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!hasSource(map, SRC_TRAFFIC)) {
      map.addSource(SRC_TRAFFIC, {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-traffic-v1'
      });
    }

    if (!hasLayer(map, LYR_TRAFFIC)) {
      map.addLayer({
        id: LYR_TRAFFIC,
        type: 'line',
        source: SRC_TRAFFIC,
        'source-layer': 'traffic',
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': [
            'match',
            ['get', 'congestion'],
            'low',
            '#76c893',
            'moderate',
            '#f4d35e',
            'heavy',
            '#f08c00',
            'severe',
            '#d00000',
            '#9ca3af'
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            0.5,
            12,
            2,
            15,
            4,
            18,
            8
          ],
          'line-offset': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            0,
            15,
            2
          ],
          'line-opacity': 0.9
        }
      });
    }
  }, []);

  const showPOI = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!hasSource(map, SRC_STREETS)) {
      map.addSource(SRC_STREETS, {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v8'
      });
    }

    if (!hasLayer(map, LYR_POI)) {
      map.addLayer({
        id: LYR_POI,
        type: 'symbol',
        source: SRC_STREETS,
        'source-layer': 'poi_label',
        layout: {
          'icon-image': ['coalesce', ['get', 'maki'], 'marker-15'],
          'icon-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            0.8,
            15,
            1.1
          ],
          'icon-allow-overlap': false,
          'text-field': ['get', 'name'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            10,
            15,
            14
          ],
          'text-offset': [0, 0.75],
          'text-anchor': 'top',
          'text-optional': true
        },
        paint: {
          'text-halo-width': 1,
          'text-halo-color': 'rgba(255,255,255,0.8)'
        }
      });
    }
  }, []);

  const showTransit = useCallback(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!hasSource(map, SRC_TRANSIT)) {
      map.addSource(SRC_TRANSIT, {
        type: 'vector',
        url: 'mapbox://mapbox.transit-v2'
      });
    }

    if (!hasLayer(map, LYR_TRANSIT_LINES)) {
      map.addLayer({
        id: LYR_TRANSIT_LINES,
        type: 'line',
        source: SRC_TRANSIT,
        'source-layer': 'transit_line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': ['coalesce', ['get', 'line_color'], '#3366cc'],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            9,
            1,
            13,
            2,
            16,
            4
          ]
        }
      });
    }

    if (!hasSource(map, SRC_STREETS)) {
      map.addSource(SRC_STREETS, {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v8'
      });
    }

    if (!hasLayer(map, LYR_TRANSIT_STOPS)) {
      map.addLayer({
        id: LYR_TRANSIT_STOPS,
        type: 'symbol',
        source: SRC_STREETS,
        'source-layer': 'transit_stop_label',
        minzoom: 11,
        layout: {
          'icon-image': 'rail-15',
          'text-field': ['get', 'name'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11,
            10,
            16,
            14
          ],
          'text-offset': [0, 0.6],
          'text-anchor': 'top'
        },
        paint: {
          'text-halo-width': 1,
          'text-halo-color': 'rgba(255,255,255,0.8)'
        }
      });
    }

    if (!hasLayer(map, LYR_RAIL_MAJOR)) {
      map.addLayer({
        id: LYR_RAIL_MAJOR,
        type: 'line',
        source: SRC_STREETS,
        'source-layer': 'road',
        filter: ['==', ['get', 'class'], 'major_rail'],
        paint: {
          'line-color': '#444444',
          'line-width': 1.2
        }
      });
    }

    if (!hasLayer(map, LYR_RAIL_MINOR)) {
      map.addLayer({
        id: LYR_RAIL_MINOR,
        type: 'line',
        source: SRC_STREETS,
        'source-layer': 'road',
        filter: ['==', ['get', 'class'], 'minor_rail'],
        paint: {
          'line-color': '#777777',
          'line-width': 0.8,
          'line-dasharray': [2, 2]
        }
      });
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (activeTab !== 'none' && !mapLoaded) {
      return;
    }

    switch (activeTab) {
      case 'traffic':
        hidePOI();
        hideTransit();
        showTraffic();
        break;
      case 'poi':
        hideTraffic();
        hideTransit();
        showPOI();
        break;
      case 'transit':
        hideTraffic();
        hidePOI();
        showTransit();
        break;
      default:
        hideTraffic();
        hidePOI();
        hideTransit();
        break;
    }
  }, [activeTab, hidePOI, hideTraffic, hideTransit, mapLoaded, showPOI, showTraffic, showTransit]);

  const handleTabClick = (key: Exclude<TabKey, 'none'>) => {
    setActiveTab((prev) => (prev === key ? 'none' : key));
  };

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
              aria-disabled={tokenMissing}
              disabled={tokenMissing}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-slate-200 bg-white`} aria-label="Interactive map">
        <div ref={containerRef} className="h-full w-full" />
        {tokenMissing ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 p-6 text-center text-sm text-red-600">
            Map unavailable. Set <code className="rounded bg-red-100 px-1 py-0.5">VITE_MAPBOX_TOKEN</code> in your environment.
          </div>
        ) : null}
      </div>
    </div>
  );
}
