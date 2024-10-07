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
    newLocation: { latitude: number | null; longitude: number | null };
}

const MapView: React.FC<MapViewProps> = ({ locations, selectedLocation, onMapClick, newLocation }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<Map | null>(null);
    const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null);

    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;

        const initialMap = new Map({
            target: mapRef.current,
            layers: [new TileLayer({ source: new OSM() })],
            view: new View({ center: [0, 0], zoom: 2 }),
        });

        const vectorSource = new VectorSource();
        const vectorLayer = new VectorLayer({ source: vectorSource });

        initialMap.addLayer(vectorLayer);
        initialMap.on('click', onMapClick);

        mapInstance.current = initialMap;
        vectorLayerRef.current = vectorLayer;

        return () => {
            initialMap.setTarget(undefined);
            mapInstance.current = null;
        };
    }, [onMapClick]);

    useEffect(() => {
        if (!mapInstance.current || !vectorLayerRef.current) return;

        const vectorSource = vectorLayerRef.current.getSource();
        if (!vectorSource) return;

        // Clear existing features
        vectorSource.clear();

        // Add features for locations
        locations.forEach(location => {
            if (location.latitude && location.longitude) {
                const feature = new Feature({
                    geometry: new Point(fromLonLat([location.longitude, location.latitude])),
                    name: `${location.description} (${location.owner})`,
                    location: location,
                });
                if (location.id) {
                    feature.setId(location.id);
                }
                vectorSource.addFeature(feature);
            }
        });

        // Update style for all features
        vectorSource.getFeatures().forEach(feature => {
            const loc = feature.get('location');
            feature.setStyle(new Style({
                image: new Circle({
                    radius: selectedLocation && selectedLocation.id === loc.id ? 8 : 6,
                    fill: new Fill({ color: selectedLocation && selectedLocation.id === loc.id ? '#e74c3c' : '#3498db' }),
                    stroke: new Stroke({ color: '#fff', width: 2 })
                }),
                text: new Text({
                    text: feature.get('name'),
                    offsetY: -15,
                    fill: new Fill({ color: '#000' }),
                    stroke: new Stroke({ color: '#fff', width: 3 })
                })
            }));
        });

        // Add feature for new location if coordinates are set
        if (newLocation.latitude !== null && newLocation.longitude !== null) {
            const newLocationFeature = new Feature({
                geometry: new Point(fromLonLat([newLocation.longitude, newLocation.latitude])),
            });

            newLocationFeature.setStyle(new Style({
                image: new Circle({
                    radius: 6,
                    fill: new Fill({ color: '#f39c12' }),
                    stroke: new Stroke({ color: '#fff', width: 2 })
                })
            }));

            vectorSource.addFeature(newLocationFeature);
        }

        // Animate to selected location if exists
        if (selectedLocation && selectedLocation.latitude && selectedLocation.longitude) {
            mapInstance.current.getView().animate({
                center: fromLonLat([selectedLocation.longitude, selectedLocation.latitude]),
                zoom: 8,
                duration: 1000
            });
        }
    }, [locations, selectedLocation, newLocation]);

    return <div className="map-container" ref={mapRef}></div>;
};

export default MapView;