const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

export const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY' && API_KEY !== '';

export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'Bruxelles': { lat: 50.8503, lng: 4.3517 },
  'Ixelles': { lat: 50.8223, lng: 4.3725 },
  'Uccle': { lat: 50.8016, lng: 4.3375 },
  'Waterloo': { lat: 50.7163, lng: 4.3981 },
  'Lasne': { lat: 50.6861, lng: 4.4851 },
  'Wavre': { lat: 50.7171, lng: 4.6063 },
  'Rixensart': { lat: 50.7141, lng: 4.5312 },
  'Etterbeek': { lat: 50.8368, lng: 4.3857 },
  'Saint-Gilles': { lat: 50.8268, lng: 4.3458 },
  'Namur': { lat: 50.4674, lng: 4.8715 },
  'Liège': { lat: 50.6326, lng: 5.5797 }
};

let mapsLoadedPromise: Promise<any> | null = null;

export function loadGoogleMapsScript(): Promise<any> {
  if (mapsLoadedPromise) return mapsLoadedPromise;

  mapsLoadedPromise = new Promise((resolve, reject) => {
    if (!hasValidKey) {
      reject(new Error('Missing Google Maps Platform API key'));
      return;
    }

    if ((window as any).google && (window as any).google.maps) {
      resolve((window as any).google.maps);
      return;
    }

    // Set callback globally
    const callbackName = '__initGoogleMapsCallback';
    (window as any)[callbackName] = () => {
      resolve((window as any).google.maps);
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,marker&callback=${callbackName}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onerror = (err) => {
      reject(err);
    };
    document.head.appendChild(script);
  });

  return mapsLoadedPromise;
}

export function getSplashHTML(): string {
  return `
    <div class="gmp-splash" style="padding: 14px; font-family: 'Inter', system-ui, sans-serif; font-size: 11px; line-height: 1.45; color: #1D1F1E; background: #FFFDF9; border: 1.5px dashed #CFC8B7; border-radius: 8px; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; box-sizing: border-box; position: absolute; inset: 0; z-index: 10;">
      <p style="margin: 0 0 6px 0; font-weight: 800; font-family: 'Lora', Georgia, serif; font-size: 13px; color: #C0553D; display: flex; align-items: center; gap: 6px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        Google Maps requis
      </p>
      <p style="margin: 0 0 8px 0; font-size: 10px; color: #5C5A53;">Pour activer les cartes dynamiques en temps réel :</p>
      <div style="text-align: left; font-size: 10px; margin-bottom: 8px; color: #1D1F1E;">
        <b>1.</b> Obtenez un jeton Google Cloud.<br>
        <b>2.</b> Dans <b>Settings (⚙️)</b> &rsaquo; <b>Secrets</b>.<br>
        <b>3.</b> Enregistrez <code>GOOGLE_MAPS_PLATFORM_KEY</code>.
      </div>
      <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener" style="font-weight: 700; color: #1E5A3A; text-decoration: underline;">
        Obtenir ma clé d'essai gratuite &rarr;
      </a>
    </div>
  `;
}

export function renderInteractiveMap(elementId: string, city: string, fullAddress: string): void {
  const container = document.getElementById(elementId);
  if (!container) return;

  // 1. If no valid key is provided, render setup splash screen
  if (!hasValidKey) {
    container.style.position = 'relative';
    container.innerHTML = getSplashHTML();
    return;
  }

  // 2. Clear element contents and show a loading state
  container.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:center; height:100%; background:#FAF7F2; font-family:monospace; font-size:11px; color:#5C5A53;">
      Chargement de la carte...
    </div>
  `;

  // 3. Load script and draw real map
  loadGoogleMapsScript()
    .then((maps) => {
      // Find coordinates. Default to city average if exact match isn't cached
      let latLng = CITY_COORDS[city] || CITY_COORDS['Bruxelles'];

      // Draw map
      const mapOptions: google.maps.MapOptions = {
        center: latLng,
        zoom: 14,
        mapId: 'DEMO_MAP_ID', // Requisite for Advanced Markers
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          {
            featureType: 'all',
            elementType: 'geometry',
            stylers: [{ color: '#f5f2ed' }]
          },
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#e5f3f7' }]
          }
        ]
      };

      const map = new maps.Map(container, mapOptions);

      // Add Internal Usage Attribution ID for GMP Compliance
      (map as any).internalUsageAttributionIds = ['gmp_mcp_codeassist_v1_aistudio'];

      // Create custom beautiful pin element
      const pinContent = document.createElement('div');
      pinContent.className = 'gmp-custom-marker';
      pinContent.style.width = '32px';
      pinContent.style.height = '32px';
      pinContent.style.borderRadius = '50%';
      pinContent.style.background = '#1E5A3A';
      pinContent.style.border = '2px solid #FFFFFF';
      pinContent.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
      pinContent.style.display = 'flex';
      pinContent.style.alignItems = 'center';
      pinContent.style.justifyContent = 'center';
      pinContent.style.color = '#FFFFFF';
      pinContent.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        </svg>
      `;

      // Draw Marker
      try {
        if (maps.marker && maps.marker.AdvancedMarkerElement) {
          const marker = new maps.marker.AdvancedMarkerElement({
            map,
            position: latLng,
            title: fullAddress || city,
            content: pinContent
          });
        } else {
          // Standard Marker Fallback
          const marker = new maps.Marker({
            map,
            position: latLng,
            title: fullAddress || city
          });
        }
      } catch (e) {
        // Safe standard marker fallback if AdvancedMarker throws
        const marker = new maps.Marker({
          map,
          position: latLng,
          title: fullAddress || city
        });
      }

      // Geocode the detailed address dynamically if possible
      const geocoder = new maps.Geocoder();
      const queryAddress = fullAddress ? `${fullAddress}, ${city}, Belgique` : `${city}, Belgique`;
      
      geocoder.geocode({ address: queryAddress }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const loc = results[0].geometry.location;
          map.setCenter(loc);
          
          // Recreate marker or reuse position
          const markerOptions = {
            map,
            position: loc,
            title: queryAddress
          };

          container.innerHTML = ''; // Clear previous and redraw map
          const newMap = new maps.Map(container, {
            ...mapOptions,
            center: loc
          });
          (newMap as any).internalUsageAttributionIds = ['gmp_mcp_codeassist_v1_aistudio'];

          try {
            if (maps.marker && maps.marker.AdvancedMarkerElement) {
              new maps.marker.AdvancedMarkerElement({
                map: newMap,
                position: loc,
                title: queryAddress,
                content: pinContent
              });
            } else {
              new maps.Marker(markerOptions);
            }
          } catch (err) {
            new maps.Marker(markerOptions);
          }
        }
      });
    })
    .catch((err) => {
      console.error('Failed to load Google Maps:', err);
      container.innerHTML = `
        <div style="padding: 12px; height: 100%; display: flex; align-items: center; justify-content: center; background: #FFF1F0; border: 1px solid #C0553D; color: #C0553D; border-radius: 6px; font-size: 11px; text-align: center;">
          Erreur de chargement Google Maps.<br>Vérifiez votre clé API d'évaluation.
        </div>
      `;
    });
}
