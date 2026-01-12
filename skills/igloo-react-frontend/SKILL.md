---
name: igloo-react-frontend
description: React 19 frontend development patterns for the Igloo Insurance platform. Use when building React components, data fetching with TanStack Query, state management with Zustand, or map visualization with deck.gl on Google Maps. Covers Custom Hooks patterns, form validation with zod, and particle effects for weather visualization.
---

# React Frontend Development

## Critical Rules

### Data Fetching (NON-NEGOTIABLE)

**NEVER** use `useEffect` for data fetching. **ALWAYS** use TanStack Query:

```tsx
// ❌ WRONG - useEffect for data fetching
useEffect(() => {
  fetch('/api/policies').then(res => res.json()).then(setData);
}, []);

// ✅ CORRECT - TanStack Query
const { data, isLoading, error } = useQuery({
  queryKey: ['policies'],
  queryFn: () => api.getPolicies()
});
```

### Component Structure

```tsx
// Functional components with strict TypeScript
interface PolicyCardProps {
  policy: Policy;
  onSelect: (id: number) => void;
}

export function PolicyCard({ policy, onSelect }: PolicyCardProps) {
  return (
    <div onClick={() => onSelect(policy.id)}>
      {policy.policyNumber}
    </div>
  );
}
```

### State Management Split

| State Type | Solution |
|------------|----------|
| Server state | TanStack Query |
| Global UI state | Zustand |
| Local component state | useState |
| Form state | react-hook-form + zod |

## Custom Hooks Pattern

Encapsulate business logic in hooks:

```tsx
// hooks/usePolicyStatistics.ts
export function usePolicyStatistics(productId: string) {
  return useQuery({
    queryKey: ['policy-stats', productId],
    queryFn: () => api.getPolicyStats(productId),
    staleTime: 5 * 60 * 1000,  // 5 minutes
  });
}

// Usage in component
function Dashboard({ productId }: Props) {
  const { data: stats, isLoading } = usePolicyStatistics(productId);
  // Component stays clean
}
```

## Zustand Global State

```tsx
// stores/uiStore.ts
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  selectedRegion: string | null;
  toggleSidebar: () => void;
  setRegion: (region: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  selectedRegion: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setRegion: (region) => set({ selectedRegion: region }),
}));
```

## Reference Files

- [TanStack Query Patterns](references/tanstack-query.md) - useQuery, useMutation, caching
- [deck.gl + Google Maps](references/deckgl-maps.md) - Map integration and layers
- [Particle Effects](references/particle-effects.md) - Weather visualization
