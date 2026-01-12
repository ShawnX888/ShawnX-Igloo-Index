# deck.gl + Google Maps Integration

## Table of Contents

1. [Setup](#setup)
2. [Layer Types](#layer-types)
3. [Google Maps Overlay](#google-maps-overlay)
4. [Performance Optimization](#performance-optimization)
5. [Interaction Handling](#interaction-handling)

---

## Setup

### Dependencies

```bash
npm install @deck.gl/core @deck.gl/layers @deck.gl/google-maps
```

### Basic Integration

```tsx
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { ScatterplotLayer } from '@deck.gl/layers';
import { useEffect, useRef } from 'react';

function MapWithDeckGL() {
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlayRef = useRef<GoogleMapsOverlay | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Create overlay
    overlayRef.current = new GoogleMapsOverlay({
      layers: [],
    });
    overlayRef.current.setMap(mapRef.current);

    return () => {
      overlayRef.current?.setMap(null);
    };
  }, []);

  // Update layers
  const updateLayers = (data: RiskEvent[]) => {
    const layers = [
      new ScatterplotLayer({
        id: 'risk-events',
        data,
        getPosition: (d) => [d.longitude, d.latitude],
        getRadius: (d) => d.tier === 'tier3' ? 5000 : 3000,
        getFillColor: (d) => getTierColor(d.tier),
        pickable: true,
      }),
    ];
    overlayRef.current?.setProps({ layers });
  };

  return <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />;
}
```

---

## Layer Types

### ScatterplotLayer (Risk Events)

```tsx
import { ScatterplotLayer } from '@deck.gl/layers';

const riskEventsLayer = new ScatterplotLayer({
  id: 'risk-events',
  data: riskEvents,
  getPosition: (d) => [d.location.lng, d.location.lat],
  getRadius: (d) => {
    switch (d.tierLevel) {
      case 'tier3': return 8000;
      case 'tier2': return 5000;
      default: return 3000;
    }
  },
  getFillColor: (d) => {
    switch (d.tierLevel) {
      case 'tier3': return [255, 0, 0, 180];   // Red
      case 'tier2': return [255, 165, 0, 180]; // Orange
      default: return [255, 255, 0, 180];      // Yellow
    }
  },
  radiusScale: 1,
  radiusMinPixels: 5,
  radiusMaxPixels: 50,
  pickable: true,
  onClick: ({ object }) => console.log('Clicked:', object),
});
```

### HeatmapLayer (Weather Intensity)

```tsx
import { HeatmapLayer } from '@deck.gl/aggregation-layers';

const heatmapLayer = new HeatmapLayer({
  id: 'rainfall-heatmap',
  data: rainfallData,
  getPosition: (d) => [d.lng, d.lat],
  getWeight: (d) => d.value,
  radiusPixels: 60,
  intensity: 1,
  threshold: 0.05,
  colorRange: [
    [65, 182, 196],
    [127, 205, 187],
    [199, 233, 180],
    [237, 248, 177],
    [255, 255, 204],
    [255, 237, 160],
  ],
});
```

### GeoJsonLayer (Region Boundaries)

```tsx
import { GeoJsonLayer } from '@deck.gl/layers';

const regionsLayer = new GeoJsonLayer({
  id: 'regions',
  data: geojsonData,
  pickable: true,
  stroked: true,
  filled: true,
  lineWidthMinPixels: 1,
  getFillColor: (f) => {
    const risk = f.properties.riskLevel;
    return risk === 'high' ? [255, 0, 0, 100] : [0, 255, 0, 50];
  },
  getLineColor: [80, 80, 80],
  getLineWidth: 1,
  onClick: ({ object }) => {
    if (object) {
      setSelectedRegion(object.properties);
    }
  },
});
```

### IconLayer (Markers)

```tsx
import { IconLayer } from '@deck.gl/layers';

const ICON_MAPPING = {
  marker: { x: 0, y: 0, width: 128, height: 128, mask: true },
};

const markersLayer = new IconLayer({
  id: 'markers',
  data: locations,
  iconAtlas: '/icons/marker-atlas.png',
  iconMapping: ICON_MAPPING,
  getIcon: () => 'marker',
  getPosition: (d) => [d.lng, d.lat],
  getSize: 40,
  getColor: (d) => d.active ? [0, 140, 255] : [128, 128, 128],
  pickable: true,
});
```

---

## Google Maps Overlay

### Complete Integration Hook

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import type { Layer } from '@deck.gl/core';

interface UseDeckGLOverlayOptions {
  map: google.maps.Map | null;
  layers: Layer[];
}

export function useDeckGLOverlay({ map, layers }: UseDeckGLOverlayOptions) {
  const overlayRef = useRef<GoogleMapsOverlay | null>(null);

  useEffect(() => {
    if (!map) return;

    overlayRef.current = new GoogleMapsOverlay({ layers: [] });
    overlayRef.current.setMap(map);

    return () => {
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.setProps({ layers });
    }
  }, [layers]);

  return overlayRef;
}
```

### Usage Example

```tsx
function WeatherMap() {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const { data: weatherData } = useWeatherData(region);
  const { data: riskEvents } = useRiskEvents(region);

  const layers = useMemo(() => [
    new HeatmapLayer({
      id: 'rainfall',
      data: weatherData ?? [],
      getPosition: (d) => [d.lng, d.lat],
      getWeight: (d) => d.rainfall,
    }),
    new ScatterplotLayer({
      id: 'risks',
      data: riskEvents ?? [],
      getPosition: (d) => [d.lng, d.lat],
      getRadius: 3000,
      getFillColor: [255, 0, 0, 150],
    }),
  ], [weatherData, riskEvents]);

  useDeckGLOverlay({ map, layers });

  return (
    <GoogleMap
      onLoad={setMap}
      mapContainerStyle={{ width: '100%', height: '600px' }}
      center={{ lat: 35, lng: 105 }}
      zoom={5}
    />
  );
}
```

---

## Performance Optimization

### Zoom-Based Layer Switching

```tsx
function useZoomBasedLayers(zoom: number, data: RiskEvent[]) {
  return useMemo(() => {
    if (zoom < 6) {
      // Low zoom: use heatmap for overview
      return [
        new HeatmapLayer({
          id: 'overview',
          data,
          getPosition: (d) => [d.lng, d.lat],
          getWeight: (d) => tierToWeight(d.tier),
          radiusPixels: 30,
        }),
      ];
    } else {
      // High zoom: show individual markers
      return [
        new ScatterplotLayer({
          id: 'markers',
          data,
          getPosition: (d) => [d.lng, d.lat],
          getRadius: 1000,
          getFillColor: (d) => getTierColor(d.tier),
        }),
      ];
    }
  }, [zoom, data]);
}
```

### Data Decimation

```tsx
function decimateData<T extends { lat: number; lng: number }>(
  data: T[],
  zoom: number,
  maxPoints: number = 10000
): T[] {
  if (data.length <= maxPoints) return data;

  // Calculate decimation factor based on zoom
  const factor = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % factor === 0);
}

// Usage
const decimatedData = useMemo(
  () => decimateData(weatherData, zoom, 5000),
  [weatherData, zoom]
);
```

### Layer Update Triggers

```tsx
const layers = useMemo(() => [
  new ScatterplotLayer({
    id: 'events',
    data,
    updateTriggers: {
      // Only recalculate when these change
      getFillColor: [selectedTier],
      getRadius: [zoom],
    },
    // ... other props
  }),
], [data, selectedTier, zoom]);
```

---

## Interaction Handling

### Tooltip on Hover

```tsx
function MapWithTooltip() {
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    y: number;
    object: RiskEvent;
  } | null>(null);

  const layers = useMemo(() => [
    new ScatterplotLayer({
      id: 'risks',
      data: riskEvents,
      pickable: true,
      onHover: (info) => {
        if (info.object) {
          setHoverInfo({
            x: info.x,
            y: info.y,
            object: info.object,
          });
        } else {
          setHoverInfo(null);
        }
      },
    }),
  ], [riskEvents]);

  return (
    <>
      <GoogleMap ... />
      {hoverInfo && (
        <div
          style={{
            position: 'absolute',
            left: hoverInfo.x,
            top: hoverInfo.y,
            background: 'white',
            padding: '8px',
            borderRadius: '4px',
          }}
        >
          <p>Tier: {hoverInfo.object.tierLevel}</p>
          <p>Value: {hoverInfo.object.triggerValue}</p>
        </div>
      )}
    </>
  );
}
```

### Click Selection

```tsx
const [selected, setSelected] = useState<RiskEvent | null>(null);

const layers = [
  new ScatterplotLayer({
    id: 'risks',
    data: riskEvents,
    pickable: true,
    onClick: ({ object }) => {
      setSelected(object ?? null);
    },
    getFillColor: (d) => 
      d.id === selected?.id 
        ? [0, 0, 255, 255]  // Selected
        : getTierColor(d.tier),
  }),
];
```
