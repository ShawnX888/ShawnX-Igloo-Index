# Particle Effects for Weather Visualization

## Table of Contents

1. [Architecture](#architecture)
2. [Rain Particles](#rain-particles)
3. [Wind Particles](#wind-particles)
4. [Performance Optimization](#performance-optimization)
5. [Mobile Degradation](#mobile-degradation)

---

## Architecture

### Recommended Approach: deck.gl

Use deck.gl for particle effects instead of Three.js:

- **Pros**: Purpose-built for geo-visualization, Google Maps integration, better performance
- **Cons**: Less flexibility for complex 3D effects

### Layer Structure

```
┌─────────────────────────────────────────┐
│           Google Maps Base              │
├─────────────────────────────────────────┤
│        deck.gl GoogleMapsOverlay        │
│  ┌───────────────────────────────────┐  │
│  │  Layer 1: Region Boundaries       │  │
│  │  Layer 2: Heatmap (rainfall)      │  │
│  │  Layer 3: Particle Animation      │  │
│  │  Layer 4: Risk Event Markers      │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## Rain Particles

### Using PointCloudLayer

```tsx
import { PointCloudLayer } from '@deck.gl/layers';

interface RainParticle {
  position: [number, number, number]; // [lng, lat, altitude]
  velocity: number;
}

function createRainLayer(
  particles: RainParticle[],
  intensity: number
) {
  return new PointCloudLayer({
    id: 'rain-particles',
    data: particles,
    getPosition: (d) => d.position,
    getColor: [100, 149, 237, 180], // Cornflower blue
    pointSize: 2,
    sizeUnits: 'pixels',
    opacity: Math.min(intensity / 100, 0.8),
  });
}
```

### Rain Animation Hook

```tsx
import { useRef, useEffect, useCallback } from 'react';

interface RainConfig {
  bounds: google.maps.LatLngBounds;
  intensity: number; // mm/hour
  particleCount: number;
}

export function useRainAnimation(config: RainConfig) {
  const particlesRef = useRef<RainParticle[]>([]);
  const frameRef = useRef<number>(0);

  // Initialize particles
  useEffect(() => {
    const { bounds, particleCount } = config;
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    particlesRef.current = Array.from({ length: particleCount }, () => ({
      position: [
        sw.lng() + Math.random() * (ne.lng() - sw.lng()),
        sw.lat() + Math.random() * (ne.lat() - sw.lat()),
        Math.random() * 1000, // Altitude 0-1000m
      ],
      velocity: 5 + Math.random() * 10, // Fall speed
    }));
  }, [config.bounds, config.particleCount]);

  // Animation loop
  const animate = useCallback(() => {
    const dt = 0.016; // ~60fps

    particlesRef.current.forEach((p) => {
      // Move particle down
      p.position[2] -= p.velocity * dt * 100;

      // Reset if below ground
      if (p.position[2] < 0) {
        p.position[2] = 1000;
        // Randomize horizontal position slightly
        p.position[0] += (Math.random() - 0.5) * 0.01;
        p.position[1] += (Math.random() - 0.5) * 0.01;
      }
    });

    frameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [animate]);

  return particlesRef.current;
}
```

---

## Wind Particles

### Wind Flow Visualization

```tsx
import { LineLayer } from '@deck.gl/layers';

interface WindParticle {
  id: string;
  path: [number, number][]; // Trail of positions
  speed: number;
  direction: number; // Degrees
}

function createWindLayer(particles: WindParticle[]) {
  return new LineLayer({
    id: 'wind-particles',
    data: particles,
    getSourcePosition: (d) => d.path[0],
    getTargetPosition: (d) => d.path[d.path.length - 1],
    getColor: (d) => {
      // Color by wind speed
      const alpha = Math.min(d.speed / 50 * 255, 255);
      return [255, 255, 255, alpha];
    },
    getWidth: 2,
    widthUnits: 'pixels',
  });
}
```

### Wind Animation with Trails

```tsx
interface WindConfig {
  bounds: google.maps.LatLngBounds;
  windData: WeatherData[]; // Grid of wind vectors
  particleCount: number;
  trailLength: number;
}

export function useWindAnimation(config: WindConfig) {
  const particlesRef = useRef<WindParticle[]>([]);

  useEffect(() => {
    // Initialize particles
    particlesRef.current = Array.from({ length: config.particleCount }, (_, i) => ({
      id: `wind-${i}`,
      path: [randomPosition(config.bounds)],
      speed: 0,
      direction: 0,
    }));
  }, [config]);

  const animate = useCallback(() => {
    particlesRef.current.forEach((p) => {
      // Get wind vector at current position
      const wind = interpolateWind(p.path[p.path.length - 1], config.windData);
      
      // Update particle
      p.speed = wind.speed;
      p.direction = wind.direction;

      // Calculate new position
      const newPos = advectParticle(
        p.path[p.path.length - 1],
        wind.speed,
        wind.direction
      );

      // Add to trail
      p.path.push(newPos);

      // Trim trail
      if (p.path.length > config.trailLength) {
        p.path.shift();
      }

      // Reset if out of bounds
      if (!config.bounds.contains({ lat: newPos[1], lng: newPos[0] })) {
        p.path = [randomPosition(config.bounds)];
      }
    });
  }, [config]);

  // Animation loop
  useAnimationFrame(animate);

  return particlesRef.current;
}

function advectParticle(
  pos: [number, number],
  speed: number,
  direction: number
): [number, number] {
  const rad = (direction * Math.PI) / 180;
  const dx = Math.sin(rad) * speed * 0.0001;
  const dy = Math.cos(rad) * speed * 0.0001;
  return [pos[0] + dx, pos[1] + dy];
}
```

---

## Performance Optimization

### Dynamic Particle Count

```tsx
function calculateParticleCount(
  zoom: number,
  bounds: google.maps.LatLngBounds,
  baseCount: number = 10000
): number {
  // Fewer particles at low zoom
  const zoomFactor = Math.pow(2, zoom - 10);
  
  // Fewer particles for larger areas
  const area = getBoundsArea(bounds);
  const areaFactor = Math.min(1, 1000000 / area);

  return Math.min(
    Math.floor(baseCount * zoomFactor * areaFactor),
    50000 // Max cap
  );
}
```

### Visibility Culling

```tsx
function useVisibleParticles(
  allParticles: Particle[],
  bounds: google.maps.LatLngBounds
) {
  return useMemo(() => {
    return allParticles.filter((p) => {
      const [lng, lat] = p.position;
      return bounds.contains({ lat, lng });
    });
  }, [allParticles, bounds]);
}
```

### Frame Rate Control

```tsx
function useAnimationFrame(callback: () => void, fps: number = 30) {
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const frameInterval = 1000 / fps;

  useEffect(() => {
    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined) {
        const delta = time - previousTimeRef.current;
        if (delta >= frameInterval) {
          callback();
          previousTimeRef.current = time;
        }
      } else {
        previousTimeRef.current = time;
      }
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [callback, frameInterval]);
}
```

---

## Mobile Degradation

### Device Detection

```tsx
function useDeviceCapabilities() {
  const [capabilities, setCapabilities] = useState({
    isMobile: false,
    isLowEnd: false,
    maxParticles: 10000,
  });

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // Check for low-end device
    const memory = (navigator as any).deviceMemory ?? 8;
    const cores = navigator.hardwareConcurrency ?? 4;
    const isLowEnd = memory < 4 || cores < 4;

    setCapabilities({
      isMobile,
      isLowEnd,
      maxParticles: isLowEnd ? 1000 : isMobile ? 3000 : 10000,
    });
  }, []);

  return capabilities;
}
```

### Adaptive Effects

```tsx
function WeatherEffects({ weatherData }: Props) {
  const { isMobile, isLowEnd, maxParticles } = useDeviceCapabilities();
  const [zoom] = useMapZoom();

  // Disable effects on very low-end devices
  if (isLowEnd && isMobile) {
    return null;
  }

  // Simplified effects on mobile
  if (isMobile) {
    return (
      <SimplifiedHeatmap 
        data={weatherData} 
        opacity={0.6}
      />
    );
  }

  // Full effects on desktop
  return (
    <>
      <RainParticles 
        data={weatherData}
        particleCount={maxParticles}
        enabled={zoom > 8}
      />
      <WindParticles
        data={weatherData}
        particleCount={maxParticles / 2}
        enabled={zoom > 6}
      />
    </>
  );
}
```

### Fallback to Static Visualization

```tsx
function AdaptiveWeatherLayer({ data, zoom }: Props) {
  const { isLowEnd } = useDeviceCapabilities();

  // Use static heatmap for low-end devices
  if (isLowEnd) {
    return (
      <HeatmapLayer
        id="weather-static"
        data={data}
        getPosition={(d) => [d.lng, d.lat]}
        getWeight={(d) => d.value}
      />
    );
  }

  // Animated particles for capable devices
  return (
    <ParticleLayer
      id="weather-animated"
      data={data}
      animate={true}
    />
  );
}
```
