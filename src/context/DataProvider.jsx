import { useState } from 'react';
import { DataContext } from './DataContext';

/**
 * Context provider component for sharing parsed Letterboxd data and app state across components.
 *
 * Args:
 *   children (ReactNode): React child elements.
 *
 * Returns:
 *   JSX.Element: DataContext Provider component wrapping children.
 */
export function DataProvider({ children }) {
  const [appState, setAppState] = useState('idle');
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [rawData, setRawData] = useState(null);
  const [enrichedData, setEnrichedData] = useState(null);
  const [enrichedWatchlist, setEnrichedWatchlist] = useState(null);
  const [enrichmentReport, setEnrichmentReport] = useState(null);
  const [tmdbReady, setTmdbReady] = useState(null);

  return (
    <DataContext.Provider value={{
      appState, setAppState,
      progress, setProgress,
      rawData, setRawData,
      enrichedData, setEnrichedData,
      enrichedWatchlist, setEnrichedWatchlist,
      enrichmentReport, setEnrichmentReport,
      tmdbReady, setTmdbReady,
    }}>
      {children}
    </DataContext.Provider>
  );
}
