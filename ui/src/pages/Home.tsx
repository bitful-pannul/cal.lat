import { useEffect, useRef } from 'react';
import { Map, View } from 'ol';
import Control from 'ol/control/Control';
import Marker from 'ol/Overlay';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';

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
      }),
    });
    const titleElement = document.createElement('h1');
    titleElement.id = 'title';
    titleElement.innerHTML = 'cal.lat';
    const titleBox = new Control({ element: titleElement });
    map.addControl(titleBox);

    const plurb = document.createElement('div');
    plurb.style.backgroundColor = 'black';
    plurb.style.width = '5px';
    plurb.style.height = '5px';
    plurb.innerHTML = 'plurb';

    fetch('/callat:callat:template.os/api/all_events')
      .then((res) => res.json())
      .then((data) => {
        console.log(data);
        map.addOverlay(new Marker({
          position: fromLonLat([data.one.lon, data.one.lat]),
          element: plurb
        }));
        map.render();
      })
      .catch((err) => {
        console.error(err);
      });

    map.on('click', function (evt) {
      console.log(evt.coordinate);
    });

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