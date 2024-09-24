import React, { useEffect, useRef, useState } from 'react';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Style, Circle, Fill, Stroke, Text } from 'ol/style';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { MapBrowserEvent } from 'ol';
import DateRangeSlider from '../components/DateSlider';

// @ts-ignore 
const BASE_URL = import.meta.env.BASE_URL;

interface Location {
  id: string;
  description: string;
  latitude: number;
  longitude: number;
  start_date: number; // Unix timestamp
  end_date: number; // Unix timestamp
}

interface NewLocation {
  description: string;
  latitude: number | null;
  longitude: number | null;
  start_date: number; // Unix timestamp
  end_date: number; // Unix timestamp
}

function Home(): JSX.Element {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<Map | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [startDate, setStartDate] = useState<number>(Math.floor(Date.now() / 1000));
  const [endDate, setEndDate] = useState<number>(Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showNewLocationPopup, setShowNewLocationPopup] = useState<boolean>(false);
  const [newLocation, setNewLocation] = useState<NewLocation>({
    description: '',
    latitude: null,
    longitude: null,
    start_date: Math.floor(Date.now() / 1000), // Unix timestamp
    end_date: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60 // Unix timestamp
  });

  useEffect(() => {
    if (!mapRef.current) return;

    const initialMap = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM()
        })
      ],
      view: new View({
        center: [0, 0],
        zoom: 2
      }),
    });

    setMap(initialMap);

    return () => initialMap.setTarget(undefined);
  }, []);

  useEffect(() => {
    if (!map) return;

    fetchLocations(startDate, endDate);
  }, [map, startDate, endDate]);

  const fetchLocations = async (start: number, end: number): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/api/locations?start=${start}&end=${end}`);
      const data: Location[] = await response.json();
      setLocations(data);
      updateMapMarkers(data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const updateMapMarkers = (locationData: Location[]): void => {
    if (!map) return;

    const vectorSource = new VectorSource();

    locationData.forEach(location => {
      if (location.start_date <= endDate && location.end_date >= startDate) {
        const feature = new Feature({
          geometry: new Point(fromLonLat([location.longitude, location.latitude])),
          name: location.description,
          location: location
        });

        vectorSource.addFeature(feature);
      }
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: (feature) => new Style({
        image: new Circle({
          radius: 6,
          fill: new Fill({ color: '#3399CC' }),
          stroke: new Stroke({ color: '#fff', width: 2 })
        }),
        text: new Text({
          text: feature.get('name'),
          offsetY: -15,
          fill: new Fill({ color: '#000' }),
          stroke: new Stroke({ color: '#fff', width: 3 })
        })
      })
    });

    map.getLayers().forEach(layer => {
      if (layer instanceof VectorLayer) {
        map.removeLayer(layer);
      }
    });

    map.addLayer(vectorLayer);
  };

  const handleMapClick = (event: MapBrowserEvent<UIEvent>): void => {
    if (!map) return;
    const clickedCoord = map.getCoordinateFromPixel(event.pixel);
    const [longitude, latitude] = toLonLat(clickedCoord);

    if (showNewLocationPopup) {
      setNewLocation(prev => ({ ...prev, latitude, longitude }));
    } else {
      const feature = map.forEachFeatureAtPixel(event.pixel, (feature) => feature);
      if (feature) {
        setSelectedLocation(feature.get('location'));
      } else {
        setSelectedLocation(null);
      }
    }
  };

  useEffect(() => {
    if (!map) return;
    map.on('click', handleMapClick);
    return () => map.un('click', handleMapClick);
  }, [map, showNewLocationPopup]);


  const handleDateRangeChange = (start: string, end: string) => {
    const startUnix = Math.floor(new Date(start).getTime() / 1000);
    const endUnix = Math.floor(new Date(end).getTime() / 1000);

    setStartDate(startUnix);
    setEndDate(endUnix);

    setNewLocation(prev => ({
      ...prev,
      start_date: startUnix,
      end_date: endUnix
    }));

    fetchLocations(startUnix, endUnix);
  };

  const handleNewLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocation.latitude || !newLocation.longitude) return;

    console.log('Submitting new location:', newLocation); // Debugging Log

    try {
      const response = await fetch(`${BASE_URL}/api/locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newLocation), // Dates are now in Unix format
      });
      if (response.ok) {
        fetchLocations(startDate, endDate);
        setShowNewLocationPopup(false);
        setNewLocation({
          description: '',
          latitude: null,
          longitude: null,
          start_date: Math.floor(Date.now() / 1000), // Unix timestamp
          end_date: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60 // Unix timestamp
        });
      }
    } catch (error) {
      console.error('Error adding new location:', error);
    }
  };

  return (
    <div className="container">
      <h1>cal.lat</h1>
      <DateRangeSlider
        startDate={new Date(startDate * 1000)}
        endDate={new Date(endDate * 1000)}
        onChange={handleDateRangeChange}
      />
      <div className="content">
        <div className="map-container" ref={mapRef}></div>
        <div className="sidebar">
          <h2>Locations</h2>
          <ul className="locations-list">
            {locations.map((location) => {
              const startDate = new Date(location.start_date * 1000).toLocaleDateString();
              const endDate = new Date(location.end_date * 1000).toLocaleDateString();
              return (
                <li
                  key={location.id}
                  className={`location-item ${selectedLocation?.id === location.id ? 'selected' : ''}`}
                  onClick={() => setSelectedLocation(location)}
                >
                  <strong>{location.description}</strong>
                  <br />
                  {startDate} - {endDate}
                </li>
              );
            })}
          </ul>
          <button className="add-location-btn" onClick={() => setShowNewLocationPopup(true)}>Add New Location</button>
        </div>
      </div>
      {selectedLocation && (
        <div className="location-details">
          <h3>{selectedLocation.description}</h3>
          <p>Coordinates: ({selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)})</p>
          <p>Date: {new Date(selectedLocation.start_date * 1000).toLocaleDateString()} - {new Date(selectedLocation.end_date * 1000).toLocaleDateString()}</p>
        </div>
      )}
      {showNewLocationPopup && (
        <div className="popup">
          <h3>Add New Location</h3>
          <form onSubmit={handleNewLocationSubmit}>
            <input
              type="text"
              value={newLocation.description}
              onChange={(e) => setNewLocation(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description"
              required
            />
            <p>Coordinates: {newLocation.latitude?.toFixed(4) || 'N/A'}, {newLocation.longitude?.toFixed(4) || 'N/A'}</p>
            <p>Click on the map to set coordinates</p>
            <DateRangeSlider
              startDate={new Date(newLocation.start_date * 1000)}
              endDate={new Date(newLocation.end_date * 1000)}
              onChange={handleDateRangeChange}
            />
            <button type="submit">Add Location</button>
            <button type="button" onClick={() => setShowNewLocationPopup(false)}>Cancel</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default Home;