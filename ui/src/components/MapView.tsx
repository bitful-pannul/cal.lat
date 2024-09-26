import React, { useEffect, useRef } from 'react';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Style, Circle, Fill, Stroke, Text } from 'ol/style';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { MapBrowserEvent } from 'ol';
import { Location } from '../store';

import 'ol/ol.css';

interface MapViewProps {
    locations: Location[];
    selectedLocation: Location | null;
    onMapClick: (event: MapBrowserEvent<UIEvent>) => void;
}

const MapView: React.FC<MapViewProps> = ({ locations, selectedLocation, onMapClick }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<Map | null>(null);

    useEffect(() => {
        if (!mapRef.current) return;

        if (!mapInstance.current) {
            const initialMap = new Map({
                target: mapRef.current,
                layers: [new TileLayer({ source: new OSM() })],
                view: new View({ center: [0, 0], zoom: 2 }),
            });

            mapInstance.current = initialMap;
            initialMap.on('click', onMapClick);
        }

        const vectorSource = new VectorSource();
        const vectorLayer = new VectorLayer({ source: vectorSource });

        const locationsToShow = selectedLocation ? [selectedLocation] : locations;

        locationsToShow.forEach(location => {
            const feature = new Feature({
                geometry: new Point(fromLonLat([location.longitude, location.latitude])),
                name: `${location.description} (${location.owner})`,
                location: location,
            });

            const isSelected = selectedLocation && selectedLocation.id === location.id;

            feature.setStyle(new Style({
                image: new Circle({
                    radius: isSelected ? 8 : 6,
                    fill: new Fill({ color: isSelected ? '#e74c3c' : '#3498db' }),
                    stroke: new Stroke({ color: '#fff', width: 2 })
                }),
                text: new Text({
                    text: feature.get('name'),
                    offsetY: -15,
                    fill: new Fill({ color: '#000' }),
                    stroke: new Stroke({ color: '#fff', width: 3 })
                })
            }));

            vectorSource.addFeature(feature);
        });

        mapInstance.current.addLayer(vectorLayer);

        if (selectedLocation) {
            mapInstance.current.getView().animate({
                center: fromLonLat([selectedLocation.longitude, selectedLocation.latitude]),
                zoom: 8,
                duration: 1000
            });
        }

        return () => {
            if (mapInstance.current) {
                mapInstance.current.removeLayer(vectorLayer);
            }
        };
    }, [locations, selectedLocation, onMapClick]);

    useEffect(() => {
        if (mapInstance.current) {
            mapInstance.current.updateSize();
        }
    }, []);

    return <div className="map-container" ref={mapRef}></div>;
};

export default MapView;