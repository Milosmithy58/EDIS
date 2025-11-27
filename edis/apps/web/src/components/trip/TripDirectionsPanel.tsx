import { useEffect, useMemo, useRef, useState } from 'react';
import { TripSegment } from '../../types/trip';
import { useGoogleMapsApi } from '../../lib/useGoogleMapsApi';

const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 } as const;

type TripDirectionsPanelProps = {
  segments: TripSegment[];
  tripName: string;
};

type StopOption = {
  id: string;
  label: string;
  value: string | google.maps.LatLngLiteral;
  description?: string;
};

const buttonBase =
  'inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

export function TripDirectionsPanel({ segments, tripName }: TripDirectionsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [startId, setStartId] = useState<string>('');
  const [endId, setEndId] = useState<string>('');
  const [mode, setMode] = useState<google.maps.TravelMode>('DRIVING');
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const serviceRef = useRef<google.maps.DirectionsService | null>(null);

  const { googleMaps, isLoading: apiLoading, error } = useGoogleMapsApi();

  const stopOptions = useMemo<StopOption[]>(() => {
    const options: StopOption[] = [];
    const pushOption = (
      id: string,
      label: string,
      value: string | google.maps.LatLngLiteral,
      description?: string
    ) => {
      options.push({ id, label, value, description });
    };

    segments.forEach((segment, index) => {
      const startName = segment.startLocation.name?.trim() || `Start ${index + 1}`;
      const endName = segment.endLocation?.name?.trim() || `End ${index + 1}`;

      const startValue =
        segment.startLocation.lat !== undefined && segment.startLocation.lng !== undefined
          ? { lat: segment.startLocation.lat, lng: segment.startLocation.lng }
          : startName;
      pushOption(`${segment.id}-start`, startName, startValue, 'Segment start');

      if (segment.endLocation) {
        const endValue =
          segment.endLocation.lat !== undefined && segment.endLocation.lng !== undefined
            ? { lat: segment.endLocation.lat, lng: segment.endLocation.lng }
            : endName;
        pushOption(`${segment.id}-end`, endName, endValue, 'Segment end');
      }
    });

    return options;
  }, [segments]);

  useEffect(() => {
    if (stopOptions.length === 0) {
      setStartId('');
      setEndId('');
      return;
    }

    setStartId((prev) => prev || stopOptions[0].id);
    setEndId((prev) => {
      if (prev) return prev;
      const last = stopOptions.at(-1);
      return last ? last.id : '';
    });
  }, [stopOptions]);

  useEffect(() => {
    if (!isOpen || !googleMaps || !mapContainerRef.current) {
      return;
    }

    if (!mapRef.current) {
      mapRef.current = new googleMaps.maps.Map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 4,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });
    }

    if (!rendererRef.current) {
      rendererRef.current = new googleMaps.maps.DirectionsRenderer({ suppressMarkers: false });
    }

    rendererRef.current.setMap(mapRef.current);
    if (panelRef.current) {
      rendererRef.current.setPanel(panelRef.current);
    }

    if (!serviceRef.current) {
      serviceRef.current = new googleMaps.maps.DirectionsService();
    }
  }, [googleMaps, isOpen]);

  const requestDirections = () => {
    if (!googleMaps) {
      setStatus('Google Maps is not available.');
      return;
    }
    if (!serviceRef.current || !rendererRef.current) {
      setStatus('Directions are not ready yet. Please try again in a moment.');
      return;
    }
    if (!startId || !endId) {
      setStatus('Select both a start and end location.');
      return;
    }
    if (startId === endId) {
      setStatus('Start and end locations must be different.');
      return;
    }

    const start = stopOptions.find((opt) => opt.id === startId);
    const end = stopOptions.find((opt) => opt.id === endId);

    if (!start || !end) {
      setStatus('Could not find the selected stops.');
      return;
    }

    setIsLoading(true);
    setStatus('Fetching directions...');

    const request: google.maps.DirectionsRequest = {
      origin: start.value,
      destination: end.value,
      travelMode: mode
    };

    serviceRef.current.route(request, (result, directionsStatus) => {
      setIsLoading(false);
      if (directionsStatus === googleMaps.maps.DirectionsStatus.OK && result) {
        rendererRef.current?.setDirections(result);
        setStatus(`Directions ready for ${tripName || 'your trip'}.`);
      } else {
        setStatus('Could not fetch directions for the selected points.');
      }
    });
  };

  const renderBody = () => {
    if (!isOpen) {
      return null;
    }

    if (apiLoading) {
      return <p className="text-sm text-slate-600 dark:text-slate-300">Loading Google Maps...</p>;
    }

    if (error || !googleMaps) {
      return (
        <p className="text-sm text-amber-700 dark:text-amber-200">
          Unable to load directions. Set VITE_GOOGLE_MAPS_API_KEY to enable this feature.
        </p>
      );
    }

    if (stopOptions.length === 0) {
      return <p className="text-sm text-slate-600 dark:text-slate-300">Add at least two stops to request directions.</p>;
    }

    return (
      <div className="space-y-4" aria-live="polite">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-label="Directions settings">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800 dark:text-slate-100">
            Start
            <select
              value={startId}
              onChange={(e) => setStartId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {stopOptions.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  {stop.label} {stop.description ? `(${stop.description})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800 dark:text-slate-100">
            End
            <select
              value={endId}
              onChange={(e) => setEndId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {stopOptions.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  {stop.label} {stop.description ? `(${stop.description})` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800 dark:text-slate-100">
            Mode
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as google.maps.TravelMode)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="DRIVING">Driving</option>
              <option value="WALKING">Walking</option>
              <option value="BICYCLING">Bicycling</option>
              <option value="TRANSIT">Transit</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={requestDirections}
              disabled={isLoading}
              className={`${buttonBase} h-11 w-full border-sky-600 bg-sky-600 text-white hover:bg-sky-700 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {isLoading ? 'Requesting...' : 'Get directions'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div
              ref={mapContainerRef}
              className="h-64 w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800"
              aria-label="Directions map"
            />
          </div>
          <div className="lg:col-span-2">
            <div
              ref={panelRef}
              className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 shadow-inner dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              aria-label="Turn-by-turn directions"
            />
          </div>
        </div>

        {status ? <p className="text-sm text-slate-600 dark:text-slate-300">{status}</p> : null}
      </div>
    );
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Guidance</p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Ask for directions</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">Use your planned stops to pull live Google Maps directions.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`${buttonBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800`}
        >
          {isOpen ? 'Hide directions' : 'Show directions'}
        </button>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">{renderBody()}</div>
    </section>
  );
}

export default TripDirectionsPanel;
