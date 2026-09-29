import React, { useState, useCallback } from 'react';
import {
  Search,
  MapPin,
  Calendar,
  CloudSun,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Globe2,
  Zap,
} from 'lucide-react';
import { useShelter } from '../../context/ShelterContext';
import {
  searchLocations,
  fetchClimateData,
  fetchRealTimeWeatherData,
  type GeocodingResult,
} from '../../lib/climateApi';

export const LocationSearch: React.FC = () => {
  const { setHourlyProfile, updateClimateMeta } = useShelter();

  // Search & Geocoding State
  const [query, setQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<GeocodingResult | null>(null);

  // Climate Date State (defaults to representative Summer Solstice)
  const [selectedDate, setSelectedDate] = useState<string>('2024-06-21');

  // Loading & Feedback State
  const [isFetchingClimate, setIsFetchingClimate] = useState<boolean>(false);
  const [fetchMode, setFetchMode] = useState<'realtime' | 'historical'>('realtime');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    details?: string;
  } | null>(null);

  // Handle Geocoding Search
  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsSearching(true);
    setFeedback(null);
    setSearchResults([]);

    const results = await searchLocations(trimmed);
    setIsSearching(false);

    if (results.length === 0) {
      setFeedback({
        type: 'error',
        message: `No location found matching "${trimmed}". Check spelling or try a broader city/state name.`,
      });
      setSelectedLocation(null);
    } else {
      setSearchResults(results);
      setSelectedLocation(results[0]); // Default to top match
    }
  }, [query]);

  // Handle Enter key in search input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSearch();
    }
  };

  // Handle Live Real-Time Weather Fetch
  const handleFetchRealTime = useCallback(async () => {
    if (!selectedLocation) return;

    setIsFetchingClimate(true);
    setFeedback(null);
    setFetchMode('realtime');

    const result = await fetchRealTimeWeatherData(
      selectedLocation.lat,
      selectedLocation.lon
    );

    setIsFetchingClimate(false);

    if (!result.success || !result.data) {
      setFeedback({
        type: 'error',
        message: result.error,
        details: 'Tip: Ensure you are connected to the internet, or try another location.',
      });
      return;
    }

    // Populate ShelterContext state with real data
    setHourlyProfile(result.data);
    updateClimateMeta('regionName', selectedLocation.displayName);
    updateClimateMeta('latitude', Number(selectedLocation.lat.toFixed(4)));
    updateClimateMeta('longitude', Number(selectedLocation.lon.toFixed(4)));
    updateClimateMeta('dateSeasonLabel', `Live Real-Time Weather Diurnal Cycle (${result.source})`);

    setFeedback({
      type: 'success',
      message: `Loaded real-time ambient temperature and solar radiation for ${selectedLocation.displayName.split(',')[0]} (${result.source}).`,
    });
  }, [selectedLocation, setHourlyProfile, updateClimateMeta]);

  // Handle NASA POWER Climate Fetch
  const handleFetchHistorical = useCallback(async () => {
    if (!selectedLocation) return;

    setIsFetchingClimate(true);
    setFeedback(null);
    setFetchMode('historical');

    const result = await fetchClimateData(
      selectedLocation.lat,
      selectedLocation.lon,
      selectedDate
    );

    setIsFetchingClimate(false);

    if (!result.success || !result.data) {
      setFeedback({
        type: 'error',
        message: result.error,
        details:
          'Tip: Select one of the solstice/equinox preset buttons or switch to Real-Time Weather.',
      });
      return;
    }

    // Populate ShelterContext state with real data
    setHourlyProfile(result.data);
    updateClimateMeta('regionName', selectedLocation.displayName);
    updateClimateMeta('latitude', Number(selectedLocation.lat.toFixed(4)));
    updateClimateMeta('longitude', Number(selectedLocation.lon.toFixed(4)));
    updateClimateMeta('dateSeasonLabel', `Climate Data — ${selectedDate} (${result.source})`);

    setFeedback({
      type: 'success',
      message: `Loaded 24-hour diurnal climate data for ${selectedLocation.displayName.split(',')[0]} (${result.source}).`,
    });
  }, [selectedLocation, selectedDate, setHourlyProfile, updateClimateMeta]);

  return (
    <div className="space-y-4 p-5 rounded-xl bg-palette-card border border-palette-border">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-palette-yellow" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-palette-text-primary">
            Real-Time Climate & Location Lookup
          </h3>
        </div>
        <p className="text-xs text-palette-text-secondary mt-0.5">
          Query any city, state, or region worldwide. Fetches real-time ambient temperature and solar radiation.
        </p>
      </div>

      {/* Step 1: Geocoding Location Search */}
      <div className="space-y-2">
        <label htmlFor="location-search-input" className="block text-xs font-medium text-palette-text-secondary">
          Step 1: Search Global Place Name
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              id="location-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Leh, Ladakh / Shimla / Dras / Srinagar / Phoenix / Denver"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-palette-raised border border-palette-border text-sm text-palette-text-primary placeholder-palette-text-muted focus:outline-none focus:border-palette-yellow transition-colors"
            />
            <Search className="w-4 h-4 text-palette-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          <button
            type="button"
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-palette-violet hover:bg-palette-violet-hover disabled:opacity-40 text-palette-text-primary text-xs font-semibold shadow-sm transition-all"
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>{isSearching ? 'Searching...' : 'Search'}</span>
          </button>
        </div>
      </div>

      {/* Geocoding Results Selector */}
      {searchResults.length > 0 && (
        <div className="space-y-1.5 p-3 rounded-lg bg-palette-raised border border-palette-border">
          <span className="text-[11px] font-semibold text-palette-text-secondary block uppercase tracking-wider">
            Matching Locations ({searchResults.length})
          </span>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {searchResults.map((loc, idx) => {
              const isSelected = selectedLocation?.displayName === loc.displayName;
              return (
                <button
                  key={`${loc.lat}-${loc.lon}-${idx}`}
                  type="button"
                  onClick={() => setSelectedLocation(loc)}
                  className={`w-full text-left px-3 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-palette-violet/30 text-palette-yellow border border-palette-violet'
                      : 'text-palette-text-secondary hover:bg-palette-card hover:text-palette-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1 mr-2">
                    <MapPin className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-palette-yellow' : 'text-palette-text-muted'}`} />
                    <span className="truncate">{loc.displayName}</span>
                  </div>
                  <span className="font-mono text-[10px] text-palette-text-muted shrink-0">
                    {loc.lat.toFixed(2)}°, {loc.lon.toFixed(2)}°
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Fetch Actions */}
      {selectedLocation && (
        <div className="p-4 rounded-lg bg-palette-raised border border-palette-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-palette-text-primary flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-palette-pink-red" />
                Selected: <strong className="text-palette-yellow">{selectedLocation.displayName.split(',')[0]}</strong>
                <span className="font-mono text-[11px] text-palette-text-muted">
                  ({selectedLocation.lat.toFixed(3)}°, {selectedLocation.lon.toFixed(3)}°)
                </span>
              </span>
              <p className="text-[11px] text-palette-text-secondary">
                Retrieve 24 hourly readings of real-time ambient temperature and downward solar radiation.
              </p>
            </div>

            {/* Primary Action: Real-Time Weather */}
            <button
              type="button"
              onClick={handleFetchRealTime}
              disabled={isFetchingClimate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-palette-pink-red hover:bg-palette-pink-red-hover disabled:opacity-40 text-palette-page text-xs font-bold shadow-md transition-all shrink-0"
            >
              {isFetchingClimate && fetchMode === 'realtime' ? (
                <Loader2 className="w-4 h-4 animate-spin text-palette-page" />
              ) : (
                <Zap className="w-4 h-4 text-palette-page" />
              )}
              <span>{isFetchingClimate && fetchMode === 'realtime' ? 'Querying Weather API...' : 'Fetch Real-Time Weather'}</span>
            </button>
          </div>

          {/* Secondary Option: Historical / Benchmark Date */}
          <div className="pt-3 border-t border-palette-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <label htmlFor="climate-date-input" className="block text-xs font-medium text-palette-text-secondary flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-palette-yellow" />
                <span>Or select Solstice / Benchmark Date</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  id="climate-date-input"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="px-2.5 py-1 rounded bg-palette-card border border-palette-border text-xs text-palette-text-primary font-mono focus:outline-none focus:border-palette-yellow"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate('2024-06-21')}
                  className="px-2 py-0.5 rounded bg-palette-card hover:bg-palette-border text-[11px] text-palette-text-secondary border border-palette-border transition-colors"
                >
                  Jun 21 (Solstice)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate('2024-12-21')}
                  className="px-2 py-0.5 rounded bg-palette-card hover:bg-palette-border text-[11px] text-palette-text-secondary border border-palette-border transition-colors"
                >
                  Dec 21 (Solstice)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate('2024-03-20')}
                  className="px-2 py-0.5 rounded bg-palette-card hover:bg-palette-border text-[11px] text-palette-text-secondary border border-palette-border transition-colors"
                >
                  Mar 20 (Equinox)
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFetchHistorical}
              disabled={isFetchingClimate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-palette-violet hover:bg-palette-violet-hover disabled:opacity-40 text-palette-text-primary text-xs font-medium transition-colors shrink-0"
            >
              {isFetchingClimate && fetchMode === 'historical' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CloudSun className="w-3.5 h-3.5 text-palette-yellow" />
              )}
              <span>{isFetchingClimate && fetchMode === 'historical' ? 'Querying...' : 'Fetch Date Profile'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Feedback & Status Banners */}
      {feedback && (
        <div
          className={`flex items-start gap-2.5 p-3 rounded-lg text-xs border ${
            feedback.type === 'success'
              ? 'bg-palette-card border-palette-magenta text-palette-text-primary'
              : 'bg-palette-card border-palette-pink-red text-palette-pink-red'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-palette-yellow shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-palette-pink-red shrink-0 mt-0.5" />
          )}
          <div className="flex-1 space-y-1">
            <span className="font-semibold block">{feedback.message}</span>
            {feedback.details && (
              <p className="text-[11px] text-palette-text-secondary leading-relaxed">{feedback.details}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-palette-text-muted hover:text-palette-text-primary text-xs ml-2"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
};
