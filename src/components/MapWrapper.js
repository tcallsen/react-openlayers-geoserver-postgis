// react
import React, { useEffect, useRef } from 'react';

// openlayers
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import XYZ from 'ol/source/XYZ'
import {transform} from 'ol/proj'
import GeoJSON from 'ol/format/GeoJSON.js';
import {bbox as bboxStrategy} from 'ol/loadingstrategy.js';
import WFS from 'ol/format/WFS';
import GML from 'ol/format/GML32';

function MapWrapper(props) {

  // refs are used instead of state to allow integration with 3rd party onclick callback;
  //  these are assigned at the end of the onload hook
  //  https://stackoverflow.com/a/60643670
  const mapRef = useRef()
  const mapElement = useRef() // remove
  const featuresLayerRef = useRef();

  // initialize map on first render - logic formerly put into componentDidMount
  useEffect( () => {

    // create geoserver generic vector features layer
    const featureSource = new VectorSource({
      format: new GeoJSON(),
      url: function (extent) {
        return (
          'http://localhost:8600/geoserver/dev/ows?service=WFS&' + 
          'version=1.0.0&request=GetFeature&typeName=dev%3Ageneric&maxFeatures=50&' + 
          'outputFormat=application%2Fjson&srsname=EPSG:3857&' +
          'bbox=' +
          extent.join(',') +
          ',EPSG:3857'
        );
      },
      strategy: bboxStrategy,
    });
    
    const featureLayer = new VectorLayer({
      source: featureSource,
      style: {
        'stroke-width': 0.75,
        'stroke-color': 'white',
        'fill-color': 'rgba(100,100,100,0.25)',
      },
    });

    // create map
    const map = new Map({
      target: mapElement.current,
      layers: [
        
        // USGS Topo
        new TileLayer({
          source: new XYZ({
            url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
          })
        }),

        // Google Maps Terrain
        /* new TileLayer({
          source: new XYZ({
            url: 'http://mt0.google.com/vt/lyrs=p&hl=en&x={x}&y={y}&z={z}',
          })
        }), */

        featureLayer

      ],
      view: new View({
        projection: 'EPSG:3857',
        center: transform([-122.42612, 37.88685], 'EPSG:4326', 'EPSG:3857'),
        zoom: 8
      }),
      controls: []
    })

    // save map and featureLary references into React refs
    featuresLayerRef.current = featureLayer;
    mapRef.current = map

    // set map onclick handler
    map.on('click', (event) => handleMapClick(event, map, featureLayer))
  },[])

  // render component
  return (      
    <div>
      <div ref={mapElement} className="map-container"></div>
    </div>
  ) 

}

// map click handler
const handleMapClick = async (event, map, featuresLayer) => {
    
  // get clicked feature from wfs layer
  // TODO: currently hard coded to a single feature
  const clickedCoord = map.getCoordinateFromPixel(event.pixel);
  const feature = featuresLayer.getSource().getFeaturesAtCoordinate(clickedCoord)[0]

  // parse properties
  const featureData = JSON.parse(feature.getProperties()['data']);

  // iterate prop
  if (featureData.iteration) {
    ++featureData.iteration;
  } else featureData.iteration = 1;

  // set property data back to feature
  feature.setProperties({ data: JSON.stringify(featureData) });
  console.log('clicked updated feature data', feature.getProperties())

  // prepare feature for WFS update transaction
  //  https://dbauszus.medium.com/wfs-t-with-openlayers-3-16-6fb6a820ac58
  const wfsFormatter = new WFS();
  const gmlFormatter = new GML({
    featureNS: 'http://localhost:8600/geoserver/dev',
    featureType: 'generic',
    srsName: 'EPSG:3857' // srs projection of map view
  });
  var xs = new XMLSerializer();
  const node = wfsFormatter.writeTransaction(null, [feature], null, gmlFormatter);
  var payload = xs.serializeToString(node);
  
  // execute POST
  await fetch('http://localhost:8600/geoserver/dev/wfs', {
    headers: new Headers({
      'Authorization': 'Basic '+btoa('admin:myawesomegeoserver'), 
      'Content-Type': 'text/xml'
    }),
    method: 'POST',
    body: payload
  });

  // clear wfs layer features to force reload from backend to ensure latest properties
  //  are available
  featuresLayer.getSource().refresh();
}

export default MapWrapper