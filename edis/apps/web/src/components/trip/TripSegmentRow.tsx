import { useMemo, useState } from 'react';
import { TripSegment, TripSegmentType } from '../../types/trip';

type TripSegmentRowProps = {
  segment: TripSegment;
  index: number;
  total: number;
  onChange: (segment: TripSegment) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

const segmentTypeOptions: { value: TripSegmentType; label: string }[] = [
  { value: 'flight', label: 'Flight' },
  { value: 'train', label: 'Train' },
  { value: 'drive', label: 'Drive' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'stop', label: 'Stop' },
];

const inputClassName =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-sky-500 dark:focus:ring-sky-900/60';

const labelClassName = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

export const TripSegmentRow = ({
  segment,
  index,
  total,
  onChange,
  onRemove,
  onMoveDown,
  onMoveUp,
}: TripSegmentRowProps) => {
  const [showCoordinates, setShowCoordinates] = useState(() => {
    const hasCoordinates =
      segment.startLocation.lat !== undefined ||
      segment.startLocation.lng !== undefined ||
      segment.endLocation?.lat !== undefined ||
      segment.endLocation?.lng !== undefined;
    return hasCoordinates;
  });

  const updateSegment = (patch: Partial<TripSegment>) => {
    onChange({ ...segment, ...patch });
  };

  const handleLocationChange = (
    key: 'startLocation' | 'endLocation',
    field: 'name' | 'lat' | 'lng',
    value: string,
  ) => {
    const target = segment[key] ?? { name: '' };
    const nextValue = field === 'name' ? value : value === '' ? undefined : Number(value);
    updateSegment({
      [key]: {
        ...target,
        [field]: Number.isNaN(nextValue as number) ? undefined : nextValue,
      },
    } as Partial<TripSegment>);
  };

  const handleDetailsChange = (field: keyof NonNullable<TripSegment['details']>, value: string) => {
    updateSegment({
      details: {
        ...segment.details,
        [field]: value,
      },
    });
  };

  const detailInputs = useMemo(() => {
    const sharedProps = { className: inputClassName };
    const details = segment.details ?? {};

    if (segment.type === 'flight') {
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClassName} htmlFor={`airline-${segment.id}`}>
              Airline
            </label>
            <input
              id={`airline-${segment.id}`}
              type="text"
              {...sharedProps}
              value={details.airline ?? ''}
              onChange={(e) => handleDetailsChange('airline', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName} htmlFor={`flight-${segment.id}`}>
              Flight #
            </label>
            <input
              id={`flight-${segment.id}`}
              type="text"
              {...sharedProps}
              value={details.flightNumber ?? ''}
              onChange={(e) => handleDetailsChange('flightNumber', e.target.value)}
            />
          </div>
        </div>
      );
    }

    if (segment.type === 'train') {
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClassName} htmlFor={`operator-${segment.id}`}>
              Operator
            </label>
            <input
              id={`operator-${segment.id}`}
              type="text"
              {...sharedProps}
              value={details.trainOperator ?? ''}
              onChange={(e) => handleDetailsChange('trainOperator', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName} htmlFor={`train-${segment.id}`}>
              Train #
            </label>
            <input
              id={`train-${segment.id}`}
              type="text"
              {...sharedProps}
              value={details.trainNumber ?? ''}
              onChange={(e) => handleDetailsChange('trainNumber', e.target.value)}
            />
          </div>
        </div>
      );
    }

    if (segment.type === 'hotel') {
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClassName} htmlFor={`hotel-${segment.id}`}>
              Hotel name
            </label>
            <input
              id={`hotel-${segment.id}`}
              type="text"
              {...sharedProps}
              value={details.hotelName ?? ''}
              onChange={(e) => handleDetailsChange('hotelName', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName} htmlFor={`confirm-${segment.id}`}>
              Confirmation #
            </label>
            <input
              id={`confirm-${segment.id}`}
              type="text"
              {...sharedProps}
              value={details.confirmationNumber ?? ''}
              onChange={(e) => handleDetailsChange('confirmationNumber', e.target.value)}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <label className={labelClassName} htmlFor={`notes-${segment.id}`}>
          Notes
        </label>
        <textarea
          id={`notes-${segment.id}`}
          className={`${inputClassName} min-h-[44px] resize-y`}
          placeholder={segment.type === 'drive' ? 'Vehicle, route notes...' : 'Add details'}
          value={details.notes ?? ''}
          onChange={(e) => handleDetailsChange('notes', e.target.value)}
        />
      </div>
    );
  }, [segment.details, segment.id, segment.type]);

  const hasBasicErrors = !segment.type || !segment.startLocation.name.trim();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-200 focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-700 dark:focus-within:ring-sky-900/50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-100">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-xs font-bold uppercase tracking-wide text-white shadow-sm">
            {index + 1}
          </span>
          <span>Segment</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Move segment up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Move segment down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-rose-950"
            aria-label="Delete segment"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <label className={labelClassName} htmlFor={`segment-type-${segment.id}`}>
            Segment type
          </label>
          <select
            id={`segment-type-${segment.id}`}
            className={inputClassName}
            value={segment.type}
            onChange={(e) => updateSegment({ type: e.target.value as TripSegmentType })}
          >
            {segmentTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className={labelClassName} htmlFor={`from-${segment.id}`}>
            From
          </label>
          <input
            id={`from-${segment.id}`}
            type="text"
            required
            className={inputClassName}
            value={segment.startLocation.name}
            onChange={(e) => handleLocationChange('startLocation', 'name', e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className={labelClassName} htmlFor={`to-${segment.id}`}>
            To
          </label>
          <input
            id={`to-${segment.id}`}
            type="text"
            className={inputClassName}
            value={segment.endLocation?.name ?? ''}
            onChange={(e) => handleLocationChange('endLocation', 'name', e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <label className={labelClassName} htmlFor={`start-${segment.id}`}>
            Start time
          </label>
          <input
            id={`start-${segment.id}`}
            type="datetime-local"
            className={inputClassName}
            value={segment.startTime ?? ''}
            onChange={(e) => updateSegment({ startTime: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClassName} htmlFor={`end-${segment.id}`}>
            End time
          </label>
          <input
            id={`end-${segment.id}`}
            type="datetime-local"
            className={inputClassName}
            value={segment.endTime ?? ''}
            onChange={(e) => updateSegment({ endTime: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClassName} htmlFor={`label-${segment.id}`}>
            Short label
          </label>
          <input
            id={`label-${segment.id}`}
            type="text"
            placeholder="e.g. LAX → JFK"
            className={inputClassName}
            value={segment.label}
            onChange={(e) => updateSegment({ label: e.target.value })}
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Details</p>
          <button
            type="button"
            onClick={() => setShowCoordinates((value) => !value)}
            className="text-xs font-semibold text-sky-700 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:text-sky-300"
            aria-expanded={showCoordinates}
            aria-controls={`coordinates-${segment.id}`}
          >
            {showCoordinates ? 'Hide' : 'Show'} coordinates
          </button>
        </div>
        {detailInputs}
      </div>

      {showCoordinates ? (
        <div id={`coordinates-${segment.id}`} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">From coordinates</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClassName} htmlFor={`from-lat-${segment.id}`}>
                  Latitude
                </label>
                <input
                  id={`from-lat-${segment.id}`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  className={inputClassName}
                  value={segment.startLocation.lat ?? ''}
                  onChange={(e) => handleLocationChange('startLocation', 'lat', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClassName} htmlFor={`from-lng-${segment.id}`}>
                  Longitude
                </label>
                <input
                  id={`from-lng-${segment.id}`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  className={inputClassName}
                  value={segment.startLocation.lng ?? ''}
                  onChange={(e) => handleLocationChange('startLocation', 'lng', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">To coordinates</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClassName} htmlFor={`to-lat-${segment.id}`}>
                  Latitude
                </label>
                <input
                  id={`to-lat-${segment.id}`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  className={inputClassName}
                  value={segment.endLocation?.lat ?? ''}
                  onChange={(e) => handleLocationChange('endLocation', 'lat', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClassName} htmlFor={`to-lng-${segment.id}`}>
                  Longitude
                </label>
                <input
                  id={`to-lng-${segment.id}`}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  className={inputClassName}
                  value={segment.endLocation?.lng ?? ''}
                  onChange={(e) => handleLocationChange('endLocation', 'lng', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {hasBasicErrors ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-100">
          Segment type and a "From" location are required.
        </p>
      ) : null}
    </div>
  );
};

export default TripSegmentRow;
