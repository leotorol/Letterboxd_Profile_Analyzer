import { useData } from '../context/DataContext';
import { parseLetterboxdZip } from '../services/zipParser';
import { enrichMovies, getEnrichmentReport, hasCachedEnrichment, TMDB_API_KEY } from '../services/tmdbApi';
import { joinEnrichmentQueue } from '../services/enrichmentQueue';
import { TMDB_POSTER_SMALL } from '../utils/tmdbImages';
import { GRAVEYARD_LIMIT, selectOldestWatchlist } from '../utils/watchlist';

// One import at a time. A double drop used to start two enrichment runs that
// fought over the same state and the shared TMDB quota.
let importInFlight = false;

/**
 * Hook to orchestrate ZIP upload parsing, TMDB enrichment, and state progression.
 *
 * Returns:
 *   Object: Function object containing processZip method.
 */
export function useLetterboxdData() {
  const {
    setAppState,
    setProgress,
    setRawData,
    setEnrichedData,
    setEnrichedWatchlist,
    setEnrichmentReport,
    setTmdbReady,
    setImportError,
  } = useData();

  /**
   * Processes uploaded Letterboxd export ZIP file.
   *
   * Validates ZIP and parses CSVs BEFORE changing app state so validation
   * errors don't cause unmount/remount flashing on the DropZone component.
   *
   * Args:
   *   file (File): Uploaded ZIP file.
   *
   * Returns:
   *   Promise<void>
   *
   * Throws:
   *   Error: If file extraction, missing CSV validation, or parsing fails.
   */
  async function processZip(file) {
    if (importInFlight) return;
    importInFlight = true;
    setImportError('');

    let queue = null;
    try {
      const parsed = await parseLetterboxdZip(file);
      setRawData(parsed);

      setAppState('loading');
      setProgress({ processed: 0, total: 0, currentMovies: [], queue: null });

      queue = await joinEnrichmentQueue(parsed.watched.length, {
        skip: hasCachedEnrichment(parsed.watched),
      });
      const queueInfo = queue.snapshot();
      const tmdbAvailable = queueInfo.tmdbReady !== false;
      setTmdbReady(tmdbAvailable);

      let recentMovies = []; // keep a rolling window of found posters for the loading strip
      setProgress({ processed: 0, total: parsed.watched.length, currentMovies: [], queue: null });

      // the queue only kicks in when the server has Redis configured, but if
      // it does we wait our turn before hammering the shared TMDB key
      if (tmdbAvailable && queueInfo.enabled && !queueInfo.admitted) {
        setProgress(prev => ({
          ...prev,
          queue: {
            enabled: true,
            admitted: false,
            position: queueInfo.position,
            waiting: queueInfo.waiting,
            active: queueInfo.active,
            maxActive: queueInfo.maxActive,
          },
        }));

        await queue.waitForTurn((snapshot) => {
          setProgress(prev => ({
            ...prev,
            queue: snapshot.enabled
              ? {
                enabled: true,
                admitted: snapshot.admitted,
                position: snapshot.position,
                waiting: snapshot.waiting,
                active: snapshot.active,
                maxActive: snapshot.maxActive,
              }
              : null,
          }));
        });
      }

      const enriched = await enrichMovies(
        parsed.watched,
        TMDB_API_KEY,
        (processed, total, batch) => {
          if (Array.isArray(batch)) {
            const entries = batch.map(m => ({
              name: m.name,
              year: m.year,
              poster: m.posterPath ? TMDB_POSTER_SMALL + m.posterPath : null,
            }));
            recentMovies = [...recentMovies, ...entries].slice(-7);
          }
          setProgress({ processed, total, currentMovies: recentMovies, queue: null });
        },
        { disabled: !tmdbAvailable },
      );

      setEnrichedData(enriched);
      // grab the watched report before the watchlist run resets the counters
      const mainReport = getEnrichmentReport();

      // Enrich the oldest watchlist movies so the graveyard has posters
      const oldestWatchlist = selectOldestWatchlist(parsed.watchlist, GRAVEYARD_LIMIT);

      if (oldestWatchlist.length > 0) {
        const enrichedWatchlist = await enrichMovies(
          oldestWatchlist,
          TMDB_API_KEY,
          () => {},
          { disabled: !tmdbAvailable },
        );
        setEnrichedWatchlist(enrichedWatchlist);
      } else {
        setEnrichedWatchlist([]);
      }

      setEnrichmentReport(mainReport);
      setAppState('ready');
    } catch (err) {
      console.error('Failed during import:', err);
      setImportError(err?.message || 'Something went wrong while importing this ZIP.');
      setAppState('idle');
      throw err;
    } finally {
      if (queue) await queue.leave();
      importInFlight = false;
    }
  }

  return { processZip };
}
