
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  ZoomControl,
  useMap,
  GeoJSON
} from 'react-leaflet';
import L from 'leaflet';

import {
  MapPin,
  Search,
  Users,
  Building2,
  BriefcaseBusiness,
  Palmtree,
  House,
  Layers3,
  Download,
  SlidersHorizontal,
  RotateCcw,
  ChevronDown,
  Info,
  Map as MapIcon
} from 'lucide-react';

import 'leaflet/dist/leaflet.css';
import './style.css';

const CATEGORIES = [
  { id: 'LGU', label: 'LGU / Government', color: '#3478f6', icon: Building2 },
  { id: 'TOURIST', label: 'Tourist spots', color: '#1e9b70', icon: Palmtree },
  { id: 'BUSINESS_OWNER', label: 'Businesses / Services', color: '#e99a28', icon: BriefcaseBusiness },
  { id: 'RESIDENT', label: 'Residential buildings', color: '#8b5bd6', icon: House }
];

function categoryInfo(id) {
  return CATEGORIES.find(category => category.id === id) || CATEGORIES[0];
}

function MapResize({ refresh }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 120);
    return () => clearTimeout(timer);
  }, [map, refresh]);

  return null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Classify mapped public places using OpenStreetMap tags.
// These are place types, NOT actual survey respondent categories.
function getPublicLocationType(p = {}) {
  if (p.natural === 'beach') return 'Beach';

  if (p.tourism === 'attraction') return 'Tourist attraction';
  if (p.tourism === 'viewpoint' || p.viewpoint != null) return 'Viewpoint';
  if (p.tourism === 'museum') return 'Museum';
  if (p.tourism === 'information') return 'Tourist information';
  if (p.tourism === 'camp_site') return 'Camping site';
  if (p.tourism === 'picnic_site') return 'Picnic site';
  if (p.tourism === 'hotel') return 'Hotel / Accommodation';
  if (p.tourism === 'guest_house') return 'Guest house';

  if (p.leisure === 'park') return 'Park';
  if (p.leisure === 'nature_reserve') return 'Nature reserve';
  if (p.leisure === 'playground') return 'Playground';
  if (p.waterway === 'waterfall' || p.waterfall != null) return 'Waterfall';
  if (p.natural === 'spring') return 'Natural spring';
  if (p.natural === 'waterfall') return 'Waterfall';
  if (p.historic) return 'Historical site';

  if (
    p.government != null ||
    p.office === 'government' ||
    p.amenity === 'townhall' ||
    p.amenity === 'courthouse'
  ) {
    return 'Government / LGU facility';
  }

  if (p.shop) return `Shop: ${p.shop}`;
  if (p.office) return `Office: ${p.office}`;
  if (p.amenity) return `Facility: ${p.amenity}`;
  if (p.leisure) return `Leisure: ${p.leisure}`;
  if (p.building) return `Building: ${p.building}`;

  return 'Mapped public location';
}

function isGovernment(p = {}) {
  return (
    p.government != null ||
    p.office === 'government' ||
    p.amenity === 'townhall' ||
    p.amenity === 'courthouse'
  );
}

function isTourism(p = {}) {
  return (
    p.tourism != null ||
    p.natural === 'beach' ||
    p.natural === 'spring' ||
    p.natural === 'waterfall' ||
    p.waterway === 'waterfall' ||
    p.waterfall != null ||
    p.leisure === 'park' ||
    p.leisure === 'nature_reserve' ||
    p.leisure === 'playground' ||
    p.viewpoint != null ||
    p.historic != null
  );
}

function isBusiness(p = {}) {
  return (
    p.shop != null ||
    p.office != null ||
    p.amenity != null ||
    ['commercial', 'retail', 'industrial'].includes(p.landuse) ||
    ['hotel', 'guest_house', 'motel', 'hostel'].includes(p.tourism)
  );
}

function isResidential(p = {}) {
  return (
    p.building === 'residential' ||
    p.building === 'apartments' ||
    p.building === 'house' ||
    p.building === 'detached' ||
    p.building === 'semidetached_house' ||
    p.building === 'terrace'
  );
}

function matchesPublicCategory(feature, category) {
  const p = feature.properties || {};

  if (category === 'ALL') return true;
  if (category === 'LGU') return isGovernment(p);
  if (category === 'TOURIST') return isTourism(p);
  if (category === 'BUSINESS_OWNER') return isBusiness(p);
  if (category === 'RESIDENT') return isResidential(p);

  return false;
}

function getFeatureColor(feature) {
  const p = feature?.properties || {};

  if (isGovernment(p)) return '#3478f6';
  if (isTourism(p)) return '#1e9b70';
  if (isBusiness(p)) return '#e99a28';
  if (isResidential(p)) return '#8b5bd6';

  return '#64748b';
}

function getFeatureBarangay(p = {}) {
  return (
    p['addr:suburb'] ||
    p['addr:place'] ||
    p['addr:district'] ||
    p.barangay ||
    ''
  );
}

function getFeatureName(p = {}) {
  return (
    p.name ||
    p['name:en'] ||
    p['name:tl'] ||
    'Unnamed location'
  );
}

function App() {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedBarangay, setSelectedBarangay] = useState('ALL');
  const [showLegend, setShowLegend] = useState(true);

  const [publicLocations, setPublicLocations] = useState(null);
  const [geoJsonError, setGeoJsonError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadLocations() {
      try {
        const response = await fetch('/borongan_locations.geojson');

        if (!response.ok) {
          throw new Error(`Could not load GeoJSON (${response.status}).`);
        }

        const data = await response.json();

        if (!data || !Array.isArray(data.features)) {
          throw new Error('The file is not a valid GeoJSON FeatureCollection.');
        }

        if (!cancelled) {
          setPublicLocations(data);
          setGeoJsonError('');
        }
      } catch (error) {
        console.error('GeoJSON loading error:', error);

        if (!cancelled) {
          setGeoJsonError(error.message);
        }
      }
    }

    loadLocations();

    return () => {
      cancelled = true;
    };
  }, []);

  const features = publicLocations?.features || [];

  const barangays = useMemo(() => {
    const names = new Set();

    features.forEach(feature => {
      const name = getFeatureBarangay(feature.properties || {});
      if (name) names.add(name);
    });

    return [...names].sort((a, b) => a.localeCompare(b));
  }, [features]);

  const filteredPublicFeatures = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return features.filter(feature => {
      const p = feature.properties || {};
      const name = getFeatureName(p);
      const type = getPublicLocationType(p);
      const barangay = getFeatureBarangay(p);

      const matchesCategory = matchesPublicCategory(feature, selectedCategory);

      const matchesSearch =
        `${name} ${type} ${barangay}`.toLowerCase().includes(searchText);

      const matchesBarangay =
        selectedBarangay === 'ALL' ||
        barangay.toLowerCase() === selectedBarangay.toLowerCase();

      return matchesCategory && matchesSearch && matchesBarangay;
    });
  }, [features, selectedCategory, search, selectedBarangay]);

  const countByCategory = categoryId =>
    filteredPublicFeatures.filter(feature =>
      matchesPublicCategory(feature, categoryId)
    ).length;

  function handleExport() {
    const headers = [
      'name',
      'place_type',
      'barangay',
      'latitude',
      'longitude',
      'source'
    ];

    const rows = filteredPublicFeatures.map(feature => {
      const p = feature.properties || {};
      const geometry = feature.geometry || {};

      let lat = '';
      let lng = '';

      if (geometry.type === 'Point') {
        [lng, lat] = geometry.coordinates;
      }

      return [
        getFeatureName(p),
        getPublicLocationType(p),
        getFeatureBarangay(p),
        lat,
        lng,
        'OpenStreetMap'
      ];
    });

    const csv = [headers, ...rows]
      .map(row =>
        row.map(value =>
          `"${String(value ?? '').replace(/"/g, '""')}"`
        ).join(',')
      )
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'borongan-city-gis-locations.csv';
    link.click();

    URL.revokeObjectURL(url);
  }

  function resetFilters() {
    setSelectedCategory('ALL');
    setSelectedBarangay('ALL');
    setSearch('');
  }

  const publicPointToLayer = (feature, latlng) => {
    const color = getFeatureColor(feature);

    return L.circleMarker(latlng, {
      radius: 6,
      color: '#ffffff',
      weight: 1.5,
      fillColor: color,
      fillOpacity: 0.92
    });
  };

  const publicFeatureStyle = feature => {
    const color = getFeatureColor(feature);

    return {
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.2
    };
  };

  const publicOnEachFeature = (feature, layer) => {
    const p = feature.properties || {};
    const name = getFeatureName(p);
    const type = getPublicLocationType(p);
    const barangay = getFeatureBarangay(p);

    const barangayLine = barangay
      ? `<br/><span>Barangay: ${escapeHtml(barangay)}</span>`
      : '';

    layer.bindPopup(`
      <div style="min-width:170px">
        <strong>${escapeHtml(name)}</strong>
        <br/>
        <span>Type: ${escapeHtml(type)}</span>
        ${barangayLine}
        <br/>
        <small>OpenStreetMap mapped location</small>
      </div>
    `);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <MapPin size={23} />
          </div>

          <div>
            <div className="brand-name">
              BORONGAN CITY <span>GIS</span>
            </div>
            <div className="brand-subtitle">
              PUBLIC LOCATION MAPPING
            </div>
          </div>
        </div>

        <div className="sidebar-scroll">
          <div className="section-label">WORKSPACE</div>

          <div className="nav-active">
            <MapIcon size={17} />
            <span>City location map</span>
            <span className="nav-dot" />
          </div>

          <div className="section-label filter-heading">
            MAP FILTERS <SlidersHorizontal size={13} />
          </div>

          <label className="field-label" htmlFor="category-search">
            Search places
          </label>

          <div className="search-wrap">
            <Search size={16} />
            <input
              id="category-search"
              placeholder="Place name or type..."
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>

          <label className="field-label" htmlFor="barangay">
            Barangay
          </label>

          <div className="select-wrap">
            <select
              id="barangay"
              value={selectedBarangay}
              onChange={event => setSelectedBarangay(event.target.value)}
            >
              <option value="ALL">All available areas</option>

              {barangays.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <ChevronDown size={15} />
          </div>

          <div className="field-label category-label">
            Location category
          </div>

          <button
            className={`category-option ${
              selectedCategory === 'ALL' ? 'chosen' : ''
            }`}
            onClick={() => setSelectedCategory('ALL')}
          >
            <span className="category-symbol all-symbol">
              <Layers3 size={16} />
            </span>
            <span className="category-name">All public places</span>
            <span className="category-count">
              {filteredPublicFeatures.length}
            </span>
          </button>

          {CATEGORIES.map(category => {
            const Icon = category.icon;

            return (
              <button
                key={category.id}
                className={`category-option ${
                  selectedCategory === category.id ? 'chosen' : ''
                }`}
                onClick={() => setSelectedCategory(category.id)}
              >
                <span
                  className="category-symbol"
                  style={{
                    color: category.color,
                    background: `${category.color}17`
                  }}
                >
                  <Icon size={16} />
                </span>

                <span className="category-name">
                  {category.label}
                </span>

                <span className="category-count">
                  {countByCategory(category.id)}
                </span>
              </button>
            );
          })}

          <button className="reset-button" onClick={resetFilters}>
            <RotateCcw size={14} /> Reset filters
          </button>

          <div className="sidebar-note">
            <Info size={15} />
            <span>
              Tourism includes mapped beaches, attractions, parks,
              viewpoints, waterfalls, springs, and historical sites.
            </span>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="status-dot" />
          Public data mode <span>v0.4</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="eyebrow">
              EASTERN SAMAR · PHILIPPINES
            </div>

            <h1>BORONGAN CITY GIS</h1>

            <p>
              Explore mapped tourist destinations, beaches,
              government facilities, and local services.
            </p>
          </div>

          <button className="export-button" onClick={handleExport}>
            <Download size={16} /> Export filtered places
          </button>
        </header>

        <section className="stats-grid">
          <div className="stat-card total-card">
            <div className="stat-top">
              <span>Places shown</span>
              <span className="stat-icon">
                <MapPin size={18} />
              </span>
            </div>

            <div className="stat-value">
              {filteredPublicFeatures.length}
              <span className="stat-unit"> places</span>
            </div>

            <div className="stat-foot">
              Matching locations in your dataset
            </div>
          </div>

          {CATEGORIES.map(category => {
            const Icon = category.icon;
            const count = countByCategory(category.id);

            return (
              <div className="stat-card" key={category.id}>
                <div className="stat-top">
                  <span>{category.label}</span>

                  <span
                    className="stat-icon"
                    style={{
                      color: category.color,
                      background: `${category.color}15`
                    }}
                  >
                    <Icon size={18} />
                  </span>
                </div>

                <div className="stat-value">{count}</div>

                <div className="stat-foot">
                  <span
                    className="mini-dot"
                    style={{ background: category.color }}
                  />
                  Matching mapped places
                </div>
              </div>
            );
          })}
        </section>

        <section className="map-section">
          <div className="map-heading">
            <div>
              <h2>Borongan City location map</h2>

              <p>
                <span className="live-dot" />
                {publicLocations
                  ? `${filteredPublicFeatures.length} matching places`
                  : 'Loading map data...'}
                <span className="muted-divider"> · </span>
                Borongan City
              </p>
            </div>

            <button
              className={`layer-button ${showLegend ? 'layer-on' : ''}`}
              onClick={() => setShowLegend(value => !value)}
            >
              <Layers3 size={16} /> Legend
            </button>
          </div>

          {geoJsonError && (
            <div
              role="alert"
              style={{
                marginBottom: 10,
                padding: 10,
                borderRadius: 8,
                background: '#fff1f0',
                color: '#a12622',
                fontSize: 13
              }}
            >
              <strong>Could not load public locations.</strong>
              <br />
              {geoJsonError}
              <br />
              Check that <code>borongan_locations.geojson</code> is inside
              the root <code>public</code> folder.
            </div>
          )}

          <div className="map-frame">
            <MapContainer
              center={[11.608, 125.431]}
              zoom={13}
              zoomControl={false}
              scrollWheelZoom={true}
              className="leaflet-map"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <ZoomControl position="bottomright" />

              <MapResize
                refresh={`${selectedCategory}-${selectedBarangay}-${showLegend}`}
              />

              {filteredPublicFeatures.length > 0 && (
                <GeoJSON
                  key={`places-${selectedCategory}-${selectedBarangay}-${search}`}
                  data={{
                    type: 'FeatureCollection',
                    features: filteredPublicFeatures
                  }}
                  pointToLayer={publicPointToLayer}
                  style={publicFeatureStyle}
                  onEachFeature={publicOnEachFeature}
                />
              )}

              {filteredPublicFeatures.length === 0 && publicLocations && (
                <></>
              )}
            </MapContainer>

            {showLegend && (
              <div className="map-legend">
                <div className="legend-title">MAP LEGEND</div>

                {CATEGORIES.map(category => (
                  <div className="legend-item" key={category.id}>
                    <span
                      className="legend-dot"
                      style={{ background: category.color }}
                    />
                    {category.label}
                  </div>
                ))}

                <div className="legend-item">
                  <span
                    className="legend-dot"
                    style={{ background: '#64748b' }}
                  />
                  Other mapped places
                </div>

                <div className="legend-separator" />

                <div className="legend-foot">
                  Colored markers indicate the mapped place category.
                </div>
              </div>
            )}

            <div className="map-disclaimer">
              BORONGAN CITY GIS · Public geographic data
            </div>
          </div>
        </section>

        <section className="bottom-grid">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h3>Location distribution</h3>
                <p>Places by selected category and filters</p>
              </div>
              <Users size={18} />
            </div>

            <div className="distribution-list">
              {CATEGORIES.map(category => {
                const count = countByCategory(category.id);

                const total = filteredPublicFeatures.length;
                const percentage = total ? (count / total) * 100 : 0;

                return (
                  <div className="distribution-row" key={category.id}>
                    <div className="distribution-label">
                      <span
                        className="legend-dot"
                        style={{ background: category.color }}
                      />
                      <span>{category.label}</span>
                      <strong>{count}</strong>
                    </div>

                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${percentage}%`,
                          background: category.color
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel insight-panel">
            <div className="panel-heading">
              <div>
                <h3>Tourism and location data</h3>
                <p>Using the map responsibly</p>
              </div>
              <Info size={18} />
            </div>

            <div className="insight-item">
              <div className="insight-icon">
                <Palmtree size={16} />
              </div>
              <div>
                <strong>Explore tourist destinations</strong>
                <p>
                  Select Tourist spots to view mapped beaches, attractions,
                  parks, viewpoints, and other tourism-related places.
                </p>
              </div>
            </div>

            <div className="insight-item">
              <div className="insight-icon">
                <MapPin size={16} />
              </div>
              <div>
                <strong>Click map markers</strong>
                <p>
                  Open a marker to see its mapped name and place type.
                  Some GeoJSON features may not have names.
                </p>
              </div>
            </div>

            <div className="insight-item">
              <div className="insight-icon">
                <Building2 size={16} />
              </div>
              <div>
                <strong>Check data coverage</strong>
                <p>
                  Only locations present in your downloaded file can appear.
                  Missing tourist spots must be added to the dataset.
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="page-footer">
          BORONGAN CITY GIS <span>·</span> Public geographic data
          <span>·</span> © OpenStreetMap contributors
        </footer>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
