import { useMemo } from 'react';
import { TripSegment } from '../../types/trip';

type SegmentMapPreviewProps = {
  segment: TripSegment;
};

const buildQuery = (segment: TripSegment) => {
  const start = segment.startLocation;
  const end = segment.endLocation;

  const startQuery = [start.lat, start.lng].every((value) => typeof value === 'number')
    ? `${start.lat},${start.lng}`
    : start.name;

  const endQuery = end
    ? [end.lat, end.lng].every((value) => typeof value === 'number')
      ? `${end.lat},${end.lng}`
      : end.name
    : '';

  const mapQuery = endQuery ? `${startQuery} to ${endQuery}` : startQuery;

  const googleMapsDirectionUrl = startQuery
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(startQuery)}${
        endQuery ? `&destination=${encodeURIComponent(endQuery)}` : ''
      }`
    : undefined;

  const mapEmbedUrl = mapQuery ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed` : undefined;

  return { mapQuery, mapEmbedUrl, googleMapsDirectionUrl };
};

export const SegmentMapPreview = ({ segment }: SegmentMapPreviewProps) => {
  const { mapEmbedUrl, googleMapsDirectionUrl } = useMemo(() => buildQuery(segment), [segment]);

  if (!mapEmbedUrl) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <p className="font-semibold">Map unavailable</p>
        <p className="mt-1">Add at least a starting location to preview this segment on Google Maps.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-700">
      <iframe
        title={`Segment map for ${segment.label || segment.startLocation.name || 'Trip segment'}`}
        src={mapEmbedUrl}
        className="h-64 w-full border-0"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <span className="font-semibold">Segment map</span>
        {googleMapsDirectionUrl ? (
          <a
            href={googleMapsDirectionUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800 transition hover:bg-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:bg-sky-900/40 dark:text-sky-100"
          >
            Open in Google Maps
          </a>
        ) : null}
      </div>
    </div>
  );
};

export default SegmentMapPreview;
