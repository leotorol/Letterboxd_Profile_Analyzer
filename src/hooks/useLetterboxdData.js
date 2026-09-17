import { useData } from '../context/DataContext';
import { parseLetterboxdZip } from '../services/zipParser';
import { enrichMovies, getEnrichmentReport, TMDB_API_KEY } from '../services/tmdbApi';
import { TMDB_POSTER_SMALL } from '../utils/tmdbImages';

/**
 * Hook to orchestrate ZIP upload parsing, TMDB enrichment, and state progression.
 *
 * Returns:
 *   Object: Function object containing processZip method.
 */
export function useLetterboxdData() {
  const { setAppState, setProgress, setRawData, setEnrichedData, setEnrichmentReport } = useData();

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
    const parsed = await parseLetterboxdZip(file);
    setRawData(parsed);

    setAppState('loading');
    setProgress({ processed: 0, total: 0 });

    try {
      let recentMovies = []; // keep a rolling window of found posters for the loading strip
      setProgress({ processed: 0, total: parsed.watched.length, currentMovies: [] });

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
          setProgress({ processed, total, currentMovies: recentMovies });
        }
      );

      setEnrichedData(enriched);
      setEnrichmentReport(getEnrichmentReport());
      setAppState('ready');
    } catch (err) {
      console.error('Failed during TMDB enrichment:', err);
      setAppState('idle');
      throw err;
    }
  }

  return { processZip };
}
