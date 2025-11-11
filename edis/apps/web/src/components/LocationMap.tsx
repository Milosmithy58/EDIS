import { useMemo } from 'react';
import type { GeoContext } from './LocationSearch';

const MAP_ZOOM_LEVEL = '12';

type LocationMapProps = {
  geo: GeoContext | null;
};

const LocationMap = ({ geo }: LocationMapProps) => {
  const mapSrc = useMemo(() => {
    if (!geo) return null;
    const params = new URLSearchParams({
      q: `${geo.lat},${geo.lon}`,
      z: MAP_ZOOM_LEVEL,
      output: 'embed'
    });
    return `https://maps.google.com/maps?${params.toString()}`;
  }, [geo]);

  if (!geo) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        Search for a place to preview it on the map.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <iframe
        key={mapSrc}
        title={`Map preview of ${geo.query}`}
        src={mapSrc}
        className="w-full border-0"
        style={{
          aspectRatio: '4 / 3',
          minHeight: '16rem',
          maxHeight: '32rem'
        }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
};

export default LocationMap;
