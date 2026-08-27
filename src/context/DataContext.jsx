import { createContext, useContext, useState } from 'react';

const DataContext = createContext(null);

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
  const [enrichmentReport, setEnrichmentReport] = useState(null);

  return (
    <DataContext.Provider value={{
      appState, setAppState,
      progress, setProgress,
      rawData, setRawData,
      enrichedData, setEnrichedData,
      enrichmentReport, setEnrichmentReport,
    }}>
      {children}
    </DataContext.Provider>
  );
}

/**
 * Custom hook to access global Letterboxd data context.
 *
 * Returns:
 *   Object: Data context values and state setters.
 *
 * Throws:
 *   Error: If invoked outside of a DataProvider tree.
 */
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) {
    // deadass forgot to wrap the app in DataProvider
    throw new Error('useData must be used inside a DataProvider or shit breaks');
  }
  return ctx;
}
