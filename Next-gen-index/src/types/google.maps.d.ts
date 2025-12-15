/**
 * Google Maps JavaScript API 类型声明
 * 
 * 这是一个简化的类型声明文件，用于支持 Google Maps JavaScript API
 * 在生产环境中，建议安装 @types/google.maps 包以获得完整的类型定义
 */

declare global {
  interface Window {
    google?: {
      maps?: {
        importLibrary: (library: string) => Promise<any>;
        MapsLibrary?: any;
        MarkerLibrary?: any;
        DataLibrary?: any;
        Map?: any;
        AdvancedMarkerElement?: any;
        Data?: any;
      };
    };
    __googleMapsInit__?: () => void;
  }

  namespace google {
    namespace maps {
      interface LatLngLiteral {
        lat: number;
        lng: number;
      }

      interface MapOptions {
        center?: LatLngLiteral;
        zoom?: number;
        mapTypeId?: string;
        disableDefaultUI?: boolean;
        zoomControl?: boolean;
        mapTypeControl?: boolean;
        scaleControl?: boolean;
        streetViewControl?: boolean;
        rotateControl?: boolean;
        fullscreenControl?: boolean;
        mapId?: string;
      }

      interface Map {
        setCenter(center: LatLngLiteral): void;
        setZoom(zoom: number): void;
        getCenter(): LatLngLiteral | null;
        getZoom(): number | null;
      }

      interface MapsLibrary {
        Map: new (container: HTMLElement, options?: MapOptions) => Map;
      }

      interface MarkerLibrary {
        AdvancedMarkerElement: any;
      }

      interface DataLibrary {
        Data: any;
      }
    }
  }
}

export {};

