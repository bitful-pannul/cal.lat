import React, { useCallback, useState } from 'react';
import { MapBrowserEvent } from 'ol';
import { toLonLat } from 'ol/proj';
import DateSlider from '../components/DateSlider';
import CalendarView from '../components/CalendarView';
import MapView from '../components/MapView';
import NewLocation from '../components/NewLocation';
import { format } from 'date-fns';
import useStore from '../store';
import FriendList from '../components/FriendList';
import Sidebar from '../components/Sidebar';

// @ts-ignore
const BASE_URL = import.meta.env.BASE_URL;

function Home(): JSX.Element {
  const [showNewLocationPopup, setShowNewLocationPopup] = useState<boolean>(false);
  const [newLocation, setNewLocation] = useState({
    description: '',
    latitude: null as number | null,
    longitude: null as number | null,
    start_date: Math.floor(Date.now() / 1000),
    end_date: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
    photos: [] as string[]
  });

  const [activeTab, setActiveTab] = useState<'map' | 'calendar' | 'friends'>('map');

  const { locations, selectedLocation, dateRange, setLocations, setSelectedLocation, setDateRange } = useStore();

  const fetchLocations = useCallback(async (start: Date, end: Date): Promise<void> => {
    try {
      const response = await fetch(`${BASE_URL}/api/locations?start=${Math.floor(start.getTime() / 1000)}&end=${Math.floor(end.getTime() / 1000)}`);
      const data = await response.json();
      setLocations(data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  }, [setLocations]);

  const handleMapClick = useCallback((event: MapBrowserEvent<UIEvent>): void => {
    const clickedCoord = event.map.getCoordinateFromPixel(event.pixel);
    const [longitude, latitude] = toLonLat(clickedCoord);

    if (showNewLocationPopup) {
      setNewLocation(prev => ({
        ...prev,
        latitude,
        longitude,
      }));
    } else {
      const feature = event.map.forEachFeatureAtPixel(event.pixel, (feature) => feature);
      if (feature) {
        setSelectedLocation(feature.get('location'));
      } else {
        setSelectedLocation(null);
      }
    }
  }, [showNewLocationPopup, setSelectedLocation]);

  const handleDateRangeChange = useCallback((start: Date, end: Date) => {
    setDateRange({ start, end });
    fetchLocations(start, end);
  }, [setDateRange, fetchLocations]);

  const handleNewLocationDateChange = useCallback((start: Date, end: Date) => {
    setNewLocation(prev => ({
      ...prev,
      start_date: Math.floor(start.getTime() / 1000),
      end_date: Math.floor(end.getTime() / 1000)
    }));
  }, []);

  const handleNewLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocation.latitude || !newLocation.longitude) return;

    try {
      const response = await fetch(`${BASE_URL}/api/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLocation),
      });
      if (response.ok) {
        fetchLocations(dateRange.start, dateRange.end);
        setShowNewLocationPopup(false);
        setNewLocation({
          description: '',
          latitude: null,
          longitude: null,
          start_date: Math.floor(Date.now() / 1000),
          end_date: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
          photos: []
        });
      }
    } catch (error) {
      console.error('Error adding new location:', error);
    }
  };

  const formatDate = (timestamp: number): string => {
    return format(new Date(timestamp * 1000), 'do MMMM yyyy');
  };

  const handleNewLocationPopup = useCallback((show: boolean) => {
    setShowNewLocationPopup(show);
    if (!show) {
      // Reset newLocation when closing the popup
      setNewLocation({
        description: '',
        latitude: null,
        longitude: null,
        start_date: Math.floor(Date.now() / 1000),
        end_date: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
        photos: []
      });
    }
  }, []);

  return (
    <div className="container">
      <h1 className="title">cal.lat</h1>
      <div className="tab-controls">
        <button onClick={() => setActiveTab('map')} className={activeTab === 'map' ? 'active' : ''}>Map</button>
        <button onClick={() => setActiveTab('calendar')} className={activeTab === 'calendar' ? 'active' : ''}>Calendar</button>
        <button onClick={() => setActiveTab('friends')} className={activeTab === 'friends' ? 'active' : ''}>Friends</button>
      </div>
      <div className="slider-container">
        <DateSlider
          startDate={dateRange.start}
          endDate={dateRange.end}
          onChange={handleDateRangeChange}
        />
      </div>
      <div className="content">
        <div className="main-content">
          {activeTab === 'map' && (
            <div className="map-view">
              <MapView
                locations={locations}
                selectedLocation={selectedLocation}
                onMapClick={handleMapClick}
                newLocation={newLocation}
              />
            </div>
          )}
          {activeTab === 'calendar' && (
            <CalendarView
              locations={locations}
              onSelectLocation={setSelectedLocation}
              startDate={dateRange.start}
              endDate={dateRange.end}
            />
          )}
          {activeTab === 'friends' && (
            <FriendList />
          )}
        </div>
        <Sidebar
          locations={locations}
          selectedLocation={selectedLocation}
          setSelectedLocation={setSelectedLocation}
          showNewLocationPopup={showNewLocationPopup}
          setShowNewLocationPopup={handleNewLocationPopup}
          formatDate={formatDate}
          newLocation={newLocation}
          setNewLocation={setNewLocation}
          handleNewLocationSubmit={handleNewLocationSubmit}
          handleNewLocationDateChange={handleNewLocationDateChange}
          onMapClick={handleMapClick}
        />
        {/* {showNewLocationPopup && (
          <NewLocation
            onSubmit={handleNewLocationSubmit}
            onCancel={() => handleNewLocationPopup(false)}
            onMapClick={handleMapClick}
            newLocation={newLocation}
            setNewLocation={setNewLocation}
            handleNewLocationDateChange={handleNewLocationDateChange}
          />
        )} */}
      </div>
    </div>
  );
}

export default Home;