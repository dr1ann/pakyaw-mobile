import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPredictions } from '@pakyaw/shared/features/maps/services/placesService';

/**
 * Hook for Ormoc-restricted Places Autocomplete with built-in 250ms debouncing (Phase 12).
 */
export function useOrmocPlacesAutocomplete(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 250);

    return () => {
      clearTimeout(handler);
    };
  }, [query]);

  const normalizedQuery = debouncedQuery.trim();

  return useQuery({
    queryKey: ['ormocPlacesAutocomplete', normalizedQuery],
    queryFn: () => getPredictions(normalizedQuery),
    enabled: normalizedQuery.length >= 3,
    staleTime: 30_000, // 30 seconds
  });
}
