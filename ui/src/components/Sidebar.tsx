import React from 'react';
import { Location, NewLocationData } from '../store';
import { MapBrowserEvent } from 'ol';
import NewLocation from './NewLocation';

interface SidebarProps {
    locations: Location[];
    selectedLocation: Location | null;
    setSelectedLocation: (location: Location | null) => void;
    setShowNewLocationPopup: (show: boolean) => void;
    formatDate: (timestamp: number) => string;
    // props for new location popup
    showNewLocationPopup: boolean;
    newLocation: NewLocationData;
    setNewLocation: React.Dispatch<React.SetStateAction<NewLocationData>>;
    handleNewLocationSubmit: (e: React.FormEvent) => Promise<void>;
    handleNewLocationDateChange: (start: Date, end: Date) => void;
    onMapClick: (event: MapBrowserEvent<UIEvent>) => void;

}

const Sidebar: React.FC<SidebarProps> = ({
    locations,
    selectedLocation,
    setSelectedLocation,
    setShowNewLocationPopup,
    formatDate,
    newLocation,
    setNewLocation,
    handleNewLocationSubmit,
    handleNewLocationDateChange,
    onMapClick,
    showNewLocationPopup
}) => {
    return (
        <div className="sidebar">
            <h2>Locations</h2>
            {!showNewLocationPopup && (
                <button className="add-location-btn" onClick={() => setShowNewLocationPopup(true)}>
                    Add New Location
                </button>
            )}
            {showNewLocationPopup && (
                <NewLocation
                    onSubmit={handleNewLocationSubmit}
                    onCancel={() => setShowNewLocationPopup(false)}
                    onMapClick={onMapClick}
                    newLocation={newLocation}
                    setNewLocation={setNewLocation}
                    handleNewLocationDateChange={handleNewLocationDateChange}
                />
            )}
            {!showNewLocationPopup && (
                selectedLocation ? (
                    <div className="location-details">
                        <button className="back-button" onClick={() => setSelectedLocation(null)}>Back</button>
                        <h3>{selectedLocation.owner}: {selectedLocation.description}</h3>
                        <p>Coordinates: ({selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)})</p>
                        <p>Date: {formatDate(selectedLocation.start_date)} - {formatDate(selectedLocation.end_date)}</p>
                        {selectedLocation.photos.length > 0 && (
                            <div className="photo-gallery">
                                {selectedLocation.photos.map((photo, index) => (
                                    <img
                                        key={index}
                                        src={`data:image/jpeg;base64,${photo}`}
                                        alt={`Photo ${index + 1}`}
                                        className="location-photo"
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <ul className="locations-list">
                        {locations.map((location) => (
                            <li
                                key={location.id}
                                className="location-item"
                                onClick={() => setSelectedLocation(location)}
                            >
                                {location.photos.length > 0 && (
                                    <img
                                        src={`data:image/jpeg;base64,${location.photos[0]}`}
                                        alt="Location thumbnail"
                                        className="location-thumbnail"
                                    />
                                )}
                                <div className="location-info">
                                    <strong>{location.description}</strong>
                                    <br />
                                    <em>{location.owner}</em>
                                    <br />
                                    {formatDate(location.start_date)} - {formatDate(location.end_date)}
                                    <br />
                                    {location.photos.length > 0 && (
                                        <span>{location.photos.length} photo{location.photos.length > 1 ? 's' : ''}</span>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )
            )}
        </div>
    );
};

export default Sidebar;