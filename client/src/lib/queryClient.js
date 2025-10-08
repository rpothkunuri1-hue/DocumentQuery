import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
      queryFn: async ({ queryKey }) => {
        const response = await fetch(queryKey[0]);
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      },
    },
  },
});

export async function apiRequest(url, options = {}) {
  const isFormData = options.body instanceof FormData;
  
  const response = await fetch(url, {
    ...options,
    headers: isFormData 
      ? options.headers
      : {
          'Content-Type': 'application/json',
          ...options.headers,
        },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}
