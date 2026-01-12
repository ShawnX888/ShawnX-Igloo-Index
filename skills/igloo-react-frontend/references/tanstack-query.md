# TanStack Query Patterns

## Table of Contents

1. [Query Setup](#query-setup)
2. [Query Patterns](#query-patterns)
3. [Mutation Patterns](#mutation-patterns)
4. [Cache Management](#cache-management)
5. [Error Handling](#error-handling)

---

## Query Setup

### Provider Configuration

```tsx
// main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,      // 1 minute
      gcTime: 5 * 60 * 1000,     // 5 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

---

## Query Patterns

### Basic Query

```tsx
import { useQuery } from '@tanstack/react-query';

function PolicyList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['policies'],
    queryFn: () => api.getPolicies(),
  });

  if (isLoading) return <Spinner />;
  if (error) return <Error message={error.message} />;
  
  return <ul>{data.map(p => <PolicyItem key={p.id} policy={p} />)}</ul>;
}
```

### Query with Parameters

```tsx
function usePoliciesByProduct(productId: string) {
  return useQuery({
    queryKey: ['policies', { productId }],
    queryFn: () => api.getPoliciesByProduct(productId),
    enabled: !!productId,  // Only run if productId exists
  });
}

// Usage
function ProductPolicies({ productId }: { productId: string }) {
  const { data, isLoading } = usePoliciesByProduct(productId);
  // ...
}
```

### Paginated Query

```tsx
interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

function usePaginatedPolicies(page: number, pageSize: number = 20) {
  return useQuery({
    queryKey: ['policies', 'paginated', { page, pageSize }],
    queryFn: () => api.getPolicies({ page, pageSize }),
    placeholderData: keepPreviousData,  // Keep previous page while loading
  });
}
```

### Dependent Queries

```tsx
function usePolicyWithClaims(policyId: number) {
  const policyQuery = useQuery({
    queryKey: ['policy', policyId],
    queryFn: () => api.getPolicy(policyId),
  });

  const claimsQuery = useQuery({
    queryKey: ['claims', { policyId }],
    queryFn: () => api.getClaimsByPolicy(policyId),
    enabled: !!policyQuery.data,  // Wait for policy to load
  });

  return { policy: policyQuery, claims: claimsQuery };
}
```

---

## Mutation Patterns

### Basic Mutation

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

function useCreatePolicy() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: PolicyCreate) => api.createPolicy(data),
    onSuccess: () => {
      // Invalidate policies list to refetch
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
  });
}

// Usage
function CreatePolicyForm() {
  const createPolicy = useCreatePolicy();
  
  const handleSubmit = (data: PolicyCreate) => {
    createPolicy.mutate(data, {
      onSuccess: () => toast.success('Policy created'),
      onError: (err) => toast.error(err.message),
    });
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* ... */}
      <button disabled={createPolicy.isPending}>
        {createPolicy.isPending ? 'Creating...' : 'Create'}
      </button>
    </form>
  );
}
```

### Optimistic Update

```tsx
function useUpdatePolicy() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: PolicyUpdate }) => 
      api.updatePolicy(id, data),
    
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['policy', id] });
      
      // Snapshot previous value
      const previous = queryClient.getQueryData(['policy', id]);
      
      // Optimistically update
      queryClient.setQueryData(['policy', id], (old: Policy) => ({
        ...old,
        ...data,
      }));
      
      return { previous };
    },
    
    onError: (err, { id }, context) => {
      // Rollback on error
      queryClient.setQueryData(['policy', id], context?.previous);
    },
    
    onSettled: (data, error, { id }) => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['policy', id] });
    },
  });
}
```

---

## Cache Management

### Query Key Factory

```tsx
// queryKeys.ts
export const queryKeys = {
  policies: {
    all: ['policies'] as const,
    list: (filters: PolicyFilters) => [...queryKeys.policies.all, 'list', filters] as const,
    detail: (id: number) => [...queryKeys.policies.all, 'detail', id] as const,
  },
  claims: {
    all: ['claims'] as const,
    byPolicy: (policyId: number) => [...queryKeys.claims.all, 'byPolicy', policyId] as const,
  },
  statistics: {
    policies: (productId: string) => ['statistics', 'policies', productId] as const,
    claims: (productId: string) => ['statistics', 'claims', productId] as const,
  },
};

// Usage
useQuery({
  queryKey: queryKeys.policies.detail(policyId),
  queryFn: () => api.getPolicy(policyId),
});
```

### Prefetching

```tsx
function PolicyListItem({ policy }: { policy: PolicySummary }) {
  const queryClient = useQueryClient();
  
  const prefetchPolicy = () => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.policies.detail(policy.id),
      queryFn: () => api.getPolicy(policy.id),
      staleTime: 60 * 1000,
    });
  };
  
  return (
    <Link 
      to={`/policies/${policy.id}`}
      onMouseEnter={prefetchPolicy}
    >
      {policy.policyNumber}
    </Link>
  );
}
```

### Selective Invalidation

```tsx
// Invalidate all policies
queryClient.invalidateQueries({ queryKey: ['policies'] });

// Invalidate specific policy
queryClient.invalidateQueries({ queryKey: ['policies', 'detail', policyId] });

// Invalidate with predicate
queryClient.invalidateQueries({
  predicate: (query) => 
    query.queryKey[0] === 'policies' && 
    query.queryKey[1]?.productId === 'rainfall-pro',
});
```

---

## Error Handling

### Global Error Handler

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      throwOnError: false,
    },
    mutations: {
      onError: (error) => {
        if (error.status === 401) {
          // Redirect to login
          window.location.href = '/login';
        }
      },
    },
  },
});
```

### Error Boundary Integration

```tsx
import { ErrorBoundary } from 'react-error-boundary';

function QueryErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div>
      <p>Something went wrong: {error.message}</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}

function Dashboard() {
  return (
    <ErrorBoundary FallbackComponent={QueryErrorFallback}>
      <PolicyStats />
    </ErrorBoundary>
  );
}
```

### Retry Configuration

```tsx
useQuery({
  queryKey: ['weather', region],
  queryFn: () => api.getWeather(region),
  retry: (failureCount, error) => {
    // Don't retry on 404
    if (error.status === 404) return false;
    // Retry up to 3 times
    return failureCount < 3;
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});
```
