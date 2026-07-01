import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, type Query } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

const PERSIST_ALLOWED_KEYS: ReadonlySet<string> = new Set(['history', 'profile']);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'pakyaw.query-cache.v1',
});

export const persistOptions = {
  persister,
  maxAge: 24 * 60 * 60 * 1000,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) => {
      const root = query.queryKey[0];
      return typeof root === 'string' && PERSIST_ALLOWED_KEYS.has(root);
    },
  },
};

