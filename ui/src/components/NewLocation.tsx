import React from 'react';
import { MapBrowserEvent } from 'ol';
import DateSlider from './DateSlider';

interface NewLocationData {
    description: string;
    latitude: number | null;
    longitude: number | null;
    start_date: number;
    end_date: number;
    photos: string[];
}

interface NewLocationProps {
    onSubmit: (e: React.FormEvent) => void;
    onCancel: () => void;
    onMapClick: (event: MapBrowserEvent<UIEvent>) => void;
    newLocation: NewLocationData;
    setNewLocation: React.Dispatch<React.SetStateAction<NewLocationData>>;
    handleNewLocationDateChange: (start: Date, end: Date) => void;
}

const NewLocation: React.FC<NewLocationProps> = ({
    onSubmit,
    onCancel,
    // onMapClick,
    newLocation,
    setNewLocation,
    handleNewLocationDateChange
}) => {
    const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64String = reader.result as string;
                    setNewLocation(prev => ({
                        ...prev,
                        photos: [...prev.photos, base64String.split(',')[1]]
                    }));
                };
                reader.readAsDataURL(file);
            });
        }
    };

    return (
        <div className="popup">
            <h3>Add New Location</h3>
            <form onSubmit={onSubmit}>
                <input
                    type="text"
                    value={newLocation.description}
                    onChange={(e) => setNewLocation(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Description"
                    required
                />
                <p>
                    Coordinates: {newLocation.latitude !== null ? newLocation.latitude.toFixed(4) : 'Click anywhere on the map to set coordinates!'},
                    {newLocation.longitude !== null ? newLocation.longitude.toFixed(4) : ''}
                </p>
                <p>Click on the map to set coordinates</p>
                <DateSlider
                    startDate={new Date(newLocation.start_date * 1000)}
                    endDate={new Date(newLocation.end_date * 1000)}
                    onChange={handleNewLocationDateChange}
                />
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                />
                <p>{newLocation.photos.length} photo(s) selected</p>
                <button type="submit">Add Location</button>
                <button type="button" onClick={onCancel}>Cancel</button>
            </form>
        </div>
    );
};

export default NewLocation;