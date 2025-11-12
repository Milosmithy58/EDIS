import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl, { type AnyLayer, type AnySourceData } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { GeoContext } from './LocationSearch';

const MAP_ZOOM_LEVEL = 12;

type DatasetKey = 'traffic' | 'poi' | 'transit';

type DatasetConfig = {
  title: string;
  description: string;
  sourceId: string;
  source: AnySourceData;
  layers: AnyLayer[];
};

const DATASET_CONFIGS: Record<DatasetKey, DatasetConfig> = {
  traffic: {
    title: 'Traffic',
    description: 'View live traffic congestion levels for major roads.',
    sourceId: 'traffic',
    source: {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-traffic-v1'
    },
    layers: [
      {
        id: 'traffic-layer',
        type: 'line',
        source: 'traffic',
        'source-layer': 'traffic',
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            1,
            10,
            3,
            15,
            6
          ],
          'line-color': [
            'match',
            ['get', 'congestion'],
            'heavy',
            '#b91c1c',
            'severe',
            '#7f1d1d',
            'moderate',
            '#f97316',
            'low',
            '#22c55e',
            'slow',
            '#facc15',
            '#1f2937'
          ],
          'line-opacity': 0.85
        }
      }
    ]
  },
  poi: {
    title: 'Points of Interest',
    description: 'Discover notable places, venues, and services nearby.',
    sourceId: 'poi',
    source: {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-streets-v8'
    },
    layers: [
      {
        id: 'poi-layer',
        type: 'symbol',
        source: 'poi',
        'source-layer': 'poi_label',
        minzoom: 10,
        layout: {
          'icon-image': 'marker-15',
          'icon-size': 1.1,
          'icon-allow-overlap': true,
          'text-field': [
            'coalesce',
            ['get', 'name_en'],
            ['get', 'name']
          ],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-offset': [0, 0.9],
          'text-size': 12,
          'text-anchor': 'top'
        },
        paint: {
          'text-color': '#1f2937',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.2
        }
      }
    ]
  },
  transit: {
    title: 'Public Transit',
    description: 'Visualize transit lines and service coverage.',
    sourceId: 'transit',
    source: {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-transit-v2'
    },
    layers: [
      {
        id: 'transit-lines',
        type: 'line',
        source: 'transit',
        'source-layer': 'transit_lines',
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            1,
            14,
            3,
            18,
            6
          ],
          'line-color': [
            'match',
            ['get', 'class'],
            'subway',
            '#1d4ed8',
            'rail',
            '#4338ca',
            'bus',
            '#dc2626',
            'ferry',
            '#0ea5e9',
            '#1f2937'
          ],
          'line-opacity': 0.85
        }
      }
    ]
  }
};

type LocationMapProps = {
  geo: GeoContext | null;
};

const DATASET_KEYS: DatasetKey[] = ['traffic', 'poi', 'transit'];

const resetDatasets = (map: mapboxgl.Map) => {
  for (const config of Object.values(DATASET_CONFIGS)) {
    for (const layer of config.layers) {
      if (map.getLayer(layer.id)) {
        map.removeLayer(layer.id);
      }
    }
    if (map.getSource(config.sourceId)) {
      map.removeSource(config.sourceId);
    }
  }
};

const applyDataset = (map: mapboxgl.Map, key: DatasetKey) => {
  const config = DATASET_CONFIGS[key];
  resetDatasets(map);
  if (!map.getSource(config.sourceId)) {
    map.addSource(config.sourceId, config.source);
  }
  for (const layer of config.layers) {
    if (!map.getLayer(layer.id)) {
      map.addLayer(layer);
    }
  }
};

const LocationMap = ({ geo }: LocationMapProps) => {
  const [activeLayer, setActiveLayer] = useState<DatasetKey | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapLoadedRef = useRef(false);
  const currentDatasetRef = useRef<DatasetKey | null>(null);
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
      currentDatasetRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!geo && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
      currentDatasetRef.current = null;
    }
  }, [geo]);

  useEffect(() => {
    if (!geo || !activeLayer || !mapboxToken || !mapContainerRef.current) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    if (!mapRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [geo.lon, geo.lat],
        zoom: MAP_ZOOM_LEVEL
      });
      mapRef.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }));
      mapLoadedRef.current = false;
    }

    const map = mapRef.current;
    if (!map) return;

    const ensureDataset = () => {
      mapLoadedRef.current = true;
      map.jumpTo({ center: [geo.lon, geo.lat], zoom: MAP_ZOOM_LEVEL });
      if (currentDatasetRef.current !== activeLayer) {
        applyDataset(map, activeLayer);
        currentDatasetRef.current = activeLayer;
      }
    };

    if (mapLoadedRef.current) {
      ensureDataset();
      return;
    }

    map.once('load', ensureDataset);

    return () => {
      map.off('load', ensureDataset);
    };
  }, [geo, activeLayer, mapboxToken]);

  const renderContent = () => {
    if (!geo) {
      return (
        <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-300">
          Search for a place to preview it on the map.
        </div>
      );
    }

    if (!mapboxToken) {
      return (
        <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-300">
          Mapbox access token is not configured. Set <code>VITE_MAPBOX_TOKEN</code> to enable the interactive map.
        </div>
      );
    }

    if (!activeLayer) {
      return (
        <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-300">
          Select a layer above to load the Mapbox visualization.
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
