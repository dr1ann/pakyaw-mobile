import { useQuery } from '@tanstack/react-query';
import { functions, httpsCallable } from '@/services/firebase/firebase';
import {
  DEFAULT_PUBLIC_TRANSPORT_CONFIG,
  type PublicTransportConfig,
} from '@pakyaw/shared/transport/contract';

export function useTransportConfig(): {
  config: PublicTransportConfig;
  isLoading: boolean;
  isError: boolean;
} {
  const query = useQuery<PublicTransportConfig, Error>({
    queryKey: ['publicTransportConfig'],
    queryFn: async () => {
      const call = httpsCallable<Record<string, never>, PublicTransportConfig>(
        functions,
        'getPublicTransportConfig'
      );
      const res = await call({});
      if (res?.data && typeof res.data === 'object') {
        return res.data;
      }
      return DEFAULT_PUBLIC_TRANSPORT_CONFIG;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    config: query.data ?? DEFAULT_PUBLIC_TRANSPORT_CONFIG,
    isLoading: query.isLoading && !query.data,
    isError: query.isError && !query.data,
  };
}
