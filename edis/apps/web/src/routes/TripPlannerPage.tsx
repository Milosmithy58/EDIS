import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { NavLink } from '../lib/navigation';
import TripSegmentRow from '../components/trip/TripSegmentRow';
import TripPlannerMap from '../components/trip/TripPlannerMap';
import { SavedTripPlan, TripPlan, TripSegment, TripSegmentType } from '../types/trip';
import { createExportFilename, downloadElementAsDocx, downloadElementAsPdf } from '../lib/download';

const STORAGE_KEY = 'edis:trip-planner';
const SAVED_TRIPS_KEY = 'edis:trip-planner:saved-trips';

const createPlanId = () =>
  crypto.randomUUID ? crypto.randomUUID() : `trip-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const defaultPlan: TripPlan = {
  id: createPlanId(),
  name: 'New trip',
  segments: [],
};

const createEmptySegment = (type: TripSegmentType = 'drive'): TripSegment => ({
  id: crypto.randomUUID ? crypto.randomUUID() : `segment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type,
  label: '',
  startLocation: { name: '' },
  endLocation: { name: '' },
  startTime: '',
  endTime: '',
  details: {},
});

const TripPlannerPage = () => {
  const [plan, setPlan] = useState<TripPlan>(defaultPlan);
  const [draftName, setDraftName] = useState(defaultPlan.name);
  const [savedTrips, setSavedTrips] = useState<SavedTripPlan[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const pageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as TripPlan;
      if (parsed && parsed.id && Array.isArray(parsed.segments)) {
        setPlan(parsed);
        setDraftName(parsed.name);
      }
      const savedRaw = localStorage.getItem(SAVED_TRIPS_KEY);
      if (savedRaw) {
        const parsedSaved = JSON.parse(savedRaw) as SavedTripPlan[];
        if (Array.isArray(parsedSaved)) {
          setSavedTrips(parsedSaved);
        }
      }
    } catch (error) {
      console.error('Failed to load saved trip plan', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...plan, name: draftName }));
    } catch (error) {
      console.error('Failed to persist trip plan', error);
    }
  }, [draftName, plan]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_TRIPS_KEY, JSON.stringify(savedTrips));
    } catch (error) {
      console.error('Failed to persist saved trips', error);
    }
  }, [savedTrips]);

  const updateSegment = (segmentId: string, updater: (prev: TripSegment) => TripSegment) => {
    setPlan((prev) => ({
      ...prev,
      segments: prev.segments.map((segment) => (segment.id === segmentId ? updater(segment) : segment)),
    }));
  };

  const addSegment = () => {
    setPlan((prev) => ({
      ...prev,
      segments: [...prev.segments, createEmptySegment(prev.segments.at(-1)?.type ?? 'drive')],
    }));
  };

  const removeSegment = (segmentId: string) => {
    setPlan((prev) => ({ ...prev, segments: prev.segments.filter((segment) => segment.id !== segmentId) }));
  };

  const moveSegment = (segmentId: string, direction: 'up' | 'down') => {
    setPlan((prev) => {
      const index = prev.segments.findIndex((segment) => segment.id === segmentId);
      if (index < 0) return prev;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.segments.length) return prev;
      const nextSegments = [...prev.segments];
      const [removed] = nextSegments.splice(index, 1);
      nextSegments.splice(targetIndex, 0, removed);
      return { ...prev, segments: nextSegments };
    });
  };

  const clearTrip = () => {
    const freshPlan = { ...defaultPlan, id: createPlanId() };
    setPlan(freshPlan);
    setDraftName(freshPlan.name);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleDownload = async (format: 'pdf' | 'docx') => {
    if (!pageRef.current) {
      toast.error('Unable to export this trip right now.');
      return;
    }

    const filename = createExportFilename(draftName || 'trip-plan', 'trip-planner');

    setIsExporting(true);
    try {
      if (format === 'pdf') {
        await downloadElementAsPdf(pageRef.current, filename);
      } else {
        await downloadElementAsDocx(pageRef.current, filename);
      }
      toast.success(`Download started (${format.toUpperCase()}).`);
    } catch (error) {
      console.error('Failed to export trip planner', error);
      toast.error('Could not generate the download.');
    } finally {
      setIsExporting(false);
    }
  };

  const saveTrip = () => {
    const cleanName = draftName.trim() || 'Untitled trip';
    const timestamp = new Date().toISOString();
    const nextPlan: SavedTripPlan = {
      ...plan,
      name: cleanName,
      id: plan.id || createPlanId(),
      updatedAt: timestamp,
    };

    setPlan(nextPlan);
    setDraftName(cleanName);
    setSavedTrips((prev) => {
      const existingIndex = prev.findIndex((trip) => trip.id === nextPlan.id);
      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex] = nextPlan;
        return copy;
      }
      return [nextPlan, ...prev];
    });
  };

  const loadTrip = (id: string) => {
    const existing = savedTrips.find((trip) => trip.id === id);
    if (!existing) return;
    setPlan(existing);
    setDraftName(existing.name);
  };

  const totalStops = useMemo(() => {
    const names = new Set<string>();
    plan.segments.forEach((segment) => {
      if (segment.startLocation.name) names.add(segment.startLocation.name);
      if (segment.endLocation?.name) names.add(segment.endLocation.name);
    });
    return names.size;
  }, [plan.segments]);

  const coordinateCount = useMemo(() => {
    let count = 0;
    plan.segments.forEach((segment) => {
      if (segment.startLocation.lat !== undefined && segment.startLocation.lng !== undefined) {
        count += 1;
      }
      if (segment.endLocation?.lat !== undefined && segment.endLocation?.lng !== undefined) {
        count += 1;
      }
    });
    return count;
  }, [plan.segments]);

  return (
    <div
      ref={pageRef}
      className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100 pb-12 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
    >
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">EDIS</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Trip planner</h1>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Plan multi-stop journeys and visualize them on a live Google Map.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <NavLink
              to="/"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ← Back to dashboard
            </NavLink>
            <button
              type="button"
              onClick={() => handleDownload('pdf')}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => handleDownload('docx')}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Download DOCX
            </button>
            <button
              type="button"
              onClick={clearTrip}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-100 dark:hover:bg-rose-950"
            >
              Clear trip
            </button>
            <button
              type="button"
              onClick={saveTrip}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100 dark:hover:bg-emerald-900"
            >
              Save trip
            </button>
            <button
              type="button"
              onClick={addSegment}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            >
              + Add segment
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="space-y-4 xl:col-span-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400" htmlFor="trip-name">
                    Trip name
                  </label>
                  <input
                    id="trip-name"
                    type="text"
                    className="w-full rounded-lg border border-slate-300 px-4 py-2 text-lg font-semibold text-slate-800 shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="e.g. NYC Business Trip"
                  />
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    Add segments to plan your route. Coordinates are optional but unlock the live map routing.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {plan.segments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <p className="font-semibold">No segments yet</p>
                  <p className="mt-2 text-sm">Start by adding a segment to build your trip.</p>
                  <button
                    type="button"
                    onClick={addSegment}
                    className="mt-4 inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                  >
                    + Add segment
                  </button>
                </div>
              ) : (
                plan.segments.map((segment, index) => (
                  <TripSegmentRow
                    key={segment.id}
                    segment={segment}
                    index={index}
                    total={plan.segments.length}
                    onChange={(updater) => updateSegment(segment.id, updater)}
                    onRemove={() => removeSegment(segment.id)}
                    onMoveUp={() => moveSegment(segment.id, 'up')}
                    onMoveDown={() => moveSegment(segment.id, 'down')}
                  />
                ))
              )}
            </div>
          </div>

          <div className="xl:col-span-2">
            <TripPlannerMap tripName={draftName} segments={plan.segments} />
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-100">Trip summary</p>
              <ul className="mt-2 space-y-1 text-sm">
                <li className="flex items-center justify-between"><span>Segments</span> <span className="font-semibold text-slate-900 dark:text-slate-100">{plan.segments.length}</span></li>
                <li className="flex items-center justify-between"><span>Stops</span> <span className="font-semibold text-slate-900 dark:text-slate-100">{totalStops}</span></li>
                <li className="flex items-center justify-between"><span>Map-ready points</span> <span className="font-semibold text-slate-900 dark:text-slate-100">{coordinateCount}</span></li>
              </ul>
            </div>
            <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Saved trips</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Load a previous plan to review or edit it.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{savedTrips.length} saved</span>
              </div>
              {savedTrips.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-300">Save a trip to keep it for later review.</p>
              ) : (
                <ul className="space-y-3">
                  {savedTrips.map((saved) => (
                    <li
                      key={saved.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold">{saved.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-300">Updated {new Date(saved.updatedAt).toLocaleString()}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => loadTrip(saved.id)}
                            className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                          >
                            Load trip
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-300">{saved.segments.length} segment(s)</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default TripPlannerPage;
