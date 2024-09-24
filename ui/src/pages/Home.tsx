import { useEffect, useRef } from 'react';
import { Map, View } from 'ol';
import Control from 'ol/control/Control';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

function Home() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM()
        })
      ],
      view: new View({
        center: [0, 0],
        zoom: 2
      })
    });
    const titleElement = document.createElement('h1');
    titleElement.id = 'title';
    titleElement.innerHTML = 'cal.lat';
    const titleBox = new Control({ element: titleElement });
    map.addControl(titleBox);

    return () => {
      map.setTarget(undefined);
    };
  }, []);

  return (
    <main>
      <div id="map" ref={mapRef}></div>
    </main>
  );
}

export default Home;