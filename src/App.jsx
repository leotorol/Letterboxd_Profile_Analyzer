import { useData } from './context/DataContext';
import DropZone from './components/DropZone/DropZone';
import LoadingScreen from './components/LoadingScreen/LoadingScreen';
import QuickFacts from './components/QuickFacts/QuickFacts';
import Rhythm from './components/Rhythm/Rhythm';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

/**
 * Root App component acting as state router wrapped in an Error Boundary.
 *
 * Returns:
 *   JSX.Element: Rendered active screen component based on appState.
 */
export default function App() {
  const { appState, setAppState, setRawData, setEnrichedData, setEnrichmentReport } = useData();

  function handleReset() {
    setAppState('idle');
    setRawData(null);
    setEnrichedData(null);
    setEnrichmentReport(null);
  }

  // switch between upload, loading progress, and stats dashboard screens
  return (
    <ErrorBoundary>
      <main>
        {appState === 'idle'    && <DropZone />}
        {appState === 'loading' && <LoadingScreen />}
        {appState === 'ready'   && (
          <>
            <QuickFacts />
            <Rhythm />
            {/* Always rendered at the very bottom of the page, horizontally centered */}
            <div className="qf-reset-wrap">
              <button className="qf-reset-btn" onClick={handleReset} aria-label="Upload a different ZIP file">
                <ArrowLeftIcon /> Upload a different file
              </button>
            </div>
          </>
        )}
      </main>
    </ErrorBoundary>
  );
}
