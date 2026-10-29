import { useEffect } from 'react';
import { useData } from './context/DataContext';
import DropZone from './components/DropZone/DropZone';
import LoadingScreen from './components/LoadingScreen/LoadingScreen';
import QuickFacts from './components/QuickFacts/QuickFacts';
import Rhythm from './components/Rhythm/Rhythm';
import CinephileProfile from './components/CinephileProfile/CinephileProfile';
import Ratings from './components/Ratings/Ratings';
import Cast from './components/Cast/Cast';
import Reviews from './components/Reviews/Reviews';
import Watchlist from './components/Watchlist/Watchlist';
import Random from './components/Random/Random';
import Pasapalabra from './components/Pasapalabra/Pasapalabra';
import Footer from './components/Footer/Footer';
import ChapterRail from './components/ChapterRail/ChapterRail';
import CinematicBackground from './components/CinematicBackground/CinematicBackground';
import ErrorBoundary from './components/ErrorBoundary';

/**
 * Root App component acting as state router wrapped in an Error Boundary.
 *
 * Returns:
 *   JSX.Element: Rendered active screen component based on appState.
 */
export default function App() {
  const { appState, setAppState, setRawData, setEnrichedData, setEnrichmentReport } = useData();

  useEffect(() => {
    if (appState === 'ready') window.scrollTo(0, 0);
  }, [appState]);

  function handleReset() {
    setAppState('idle');
    setRawData(null);
    setEnrichedData(null);
    setEnrichmentReport(null);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    window.scrollTo(0, 0);
  }

  // switch between upload, loading progress, and stats dashboard screens
  return (
    <ErrorBoundary>
      <CinematicBackground />
      <a href="#main-content" className="skip-nav">Skip to content</a>
      <main id="main-content">
        {appState === 'idle'    && <DropZone />}
        {appState === 'loading' && <LoadingScreen />}
        {appState === 'ready'   && (
          <>
            <ChapterRail onReset={handleReset} />
            <QuickFacts />
            <Rhythm />
            <CinephileProfile />
            <Ratings />
            <Cast />
            <Reviews />
            <Watchlist />
            <Random />
            <Pasapalabra />
            <Footer />
          </>
        )}
      </main>
    </ErrorBoundary>
  );
}
