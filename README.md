# Write WFS Feature data to PostGIS using OpenLayers and Geoserver

A sample application with a React/OpenLayers frontend that writes feature data to PostGIS using GeoServer WFS Transaction support. 

The backend PostGIS/GeoServer is provided via the [kartoza/docker-geoserver](https://github.com/kartoza/docker-geoserver/) image, which is included a git submodule. The application UI code is contained in this repo and based on `create-react-app`.

![Using React and OpenLayers to write feature data to PostGIS via GeoServer WFS Transactions](https://taylor.callsen.me/wp-content/uploads/2023/08/tcallsen-openlayers-feature-data-v2.jpg)

## Features

- The [WFS layer is created](https://github.com/scenic-routing/react-openlayers-geoserver-postgis/blob/master/src/components/MapWrapper.js#L88-L110) and added to the OpenLayes map
- Writing feature properties to the GeoServer WFS layer is done in an [OpenLayers map onclick callback function](https://github.com/scenic-routing/react-openlayers-geoserver-postgis/blob/master/src/components/MapWrapper.js#L37-L74). 
- [React refs](https://github.com/scenic-routing/react-openlayers-geoserver-postgis/blob/master/src/components/MapWrapper.js#L28-L30) were used to maintain OpenLayers object references between React renders, and make the objects available to the callback function.

## Install

First initialize the git submodule used for the `kartoza/docker-geoserver` image:

```
git submodule update --init --recursive
```

Then install React/Node dependencies with the following command:

```
nvm use
npm install
```

## Start

### Backend - PostGIS/GeoServer

The backend servers can be started with `docker-compose`:

```
cd docker-geoserver
docker-compose up -d
```

PostGIS should be reachable at: `postgresql://docker:docker@localhost:32767/gis`.

GeoServer should be available at: [http://admin:myawesomegeoserver@localhost:8600/geoserver/web/](http://admin:myawesomegeoserver@localhost:8600/geoserver/web/).

**Note:** The backend still requires configuration before use - see the `Configure Backend` section below.

### Frontend - React/OpenLayers

To run a development build and launch the React development server, execute:

```
npm start
```

Once completed, the frontend should be avialable at: [http://localhost:3000/](http://localhost:3000/).

## Configure Backend

### PostGIS

Execute the following SQL commands to create a table named `generic` and a sample record. Make sure the table includes a primary key, or GeoServer will not be able to perform updates to the underlying row!

```
CREATE TABLE public.generic (
    id bigint NOT NULL,
    type character varying,
    geometry public.geometry NOT NULL,
    data json
);

ALTER TABLE public.generic ADD CONSTRAINT generic_pk PRIMARY KEY (id);

ALTER TABLE public.generic OWNER TO docker;

INSERT INTO public.generic VALUES (0, 'polygon', '0103000020E6100000010000000D00000033F47CA192B65EC00B8F9772F6014340AC087DA1B89F5EC0D2CCBCDF462F43408FA17CA1726D5EC0C1368D5BB91E4340A20E7DA1C04C5EC0FCDD0E23CD0F4340F7D07CA1765A5EC01D1EAF5F39E64240F5F37CA1BA7F5EC0376020AA71ED424034597DA17A745EC0C6688AAF84CB424088C77CA13A695EC0921437E6A3A14240FCCD7CA1F2835EC059A299581F9842404D3B7DA1189A5EC01573218E70B742405CEF7CA188A25EC097B01043C7E1424070287DA1A0B75EC0D7AD5E2B38F0424033F47CA192B65EC00B8F9772F6014340', '{"source":"sql-direct","iteration":32}');
```

### GeoServer

First log into the GeoServer instance: [http://admin:myawesomegeoserver@localhost:8600/geoserver/web/](http://admin:myawesomegeoserver@localhost:8600/geoserver/web/)

Create a new Workspace called `dev`.

![Create a Workspace in GeoServer](https://taylor.callsen.me/wp-content/uploads/2023/08/tcallsen-geoserver-create-workspace.png)

Next we need to create a Data Source. Select the `PostGIS` type under Vector Data Sources.

![Create a Data Source in GeoServer](https://taylor.callsen.me/wp-content/uploads/2023/08/tcallsen-geoserver-create-data-source.jpg)

- Data Source Name: `generic`
- Host: `db` (internal connection between docker containers; using `docker-compose` service name)
- Post: `5432`
- Database: `gis`
- Schema: `public`
- User: `docker`
- Password: `docker`
- **Important!** SSL Mode: `ALLOW` (required for these docker containers to talk to each other)

Finally we will create a new Layer that publishes the `generic` table we created in PostGIS.

![Create a new Layer in GeoServer](https://taylor.callsen.me/wp-content/uploads/2023/08/tcallsen-geoserver-create-layer.png)

When creating the layer, make sure to generate the Bounding Boxes with the `Compute from data` and `Compute from native bounds` links. Otherwise the default settings will work.

## Development Environment

This application was developed using create-react-app, with Node version v18.16.0
