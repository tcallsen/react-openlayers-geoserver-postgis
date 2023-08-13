// react
import React, { useState, useEffect, useRef } from 'react';

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

import {Buffer} from 'buffer';

const GEOSERVER_BASE_URL = 'http://localhost:8600/geoserver/dev';

function MapWrapper(props) {

  const [featureData, setFeatureData] = useState();

  // refs are used instead of state to allow integration with 3rd party map onclick callback;
  //  these are assigned at the end of the onload hook
  //  https://stackoverflow.com/a/60643670
  const mapRef = useRef();
  const mapElement = useRef();
  const featuresLayerRef = useRef();

  // map click handler - uses state and refs available in closure
  const handleMapClick = async (event) => {

    // get clicked feature from wfs layer
    // TODO: currently only handles a single feature
    const clickedCoord = mapRef.current.getCoordinateFromPixel(event.pixel);
    const clickedFeatures = featuresLayerRef.current.getSource().getFeaturesAtCoordinate(clickedCoord);
    if (!clickedFeatures.length) return; // exit callback if no features clicked
    const feature = clickedFeatures[0];

    // parse feature properties
    const featureData = JSON.parse(feature.getProperties()['data']);

    // iterate prop to test write-back
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
      featureNS: GEOSERVER_BASE_URL,
      featureType: 'generic',
      srsName: 'EPSG:3857' // srs projection of map view
    });
    var xs = new XMLSerializer();
    const node = wfsFormatter.writeTransaction(null, [feature], null, gmlFormatter);
    var payload = xs.serializeToString(node);

    // execute POST
    await fetch(GEOSERVER_BASE_URL + '/wfs', {
      headers: new Headers({
        'Authorization': 'Basic ' + Buffer.from('admin:myawesomegeoserver').toString('base64'),
        'Content-Type': 'text/xml'
      }),
      method: 'POST',
      body: payload
    });

    // clear wfs layer features to force reload from backend to ensure latest properties
    //  are available
    featuresLayerRef.current.getSource().refresh();

    // display updated feature data on map
    setFeatureData(JSON.stringify(featureData));
  }

  // initialize map on first render - logic formerly put into componentDidMount
  useEffect( () => {

    // create geoserver generic vector features layer
    const featureSource = new VectorSource({
      format: new GeoJSON(),
      url: function (extent) {
        return (
          GEOSERVER_BASE_URL + '/ows?service=WFS&' +
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

      { featureData ?
        (
        <div className="feature-data-display">
          <p>Feature data: {featureData}</p>
        </div>
        ) :
        null
      }

    </div>
  ) 

}

export default MapWrapper