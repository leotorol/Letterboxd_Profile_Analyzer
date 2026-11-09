import { createContext, useContext } from 'react';

export const DataContext = createContext(null);

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
    throw new Error('useData must be used inside a DataProvider');
  }
  return ctx;
}
