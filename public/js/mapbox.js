/* eslint-disable */

export const displayMap = (locations) => {
  mapboxgl.accessToken =
    'pk.eyJ1IjoiZGstY2hldmFsaWVyIiwiYSI6ImNsbWEzOGp0aTBnbGkzZG1iODM1d2s3NXQifQ.V9FthG8gHIqpquI4a6G4yw';
  const map = new mapboxgl.Map({
    container: 'map', // container ID
    style: 'mapbox://styles/dk-chevalier/clma4g4xe012a01qz2p3pcolh', // style URL
    scrollZoom: false, // so mouse doesn't change zoom level
    // center: [-118, 34], // starting position [lng, lat]
    // zoom: 9, // starting zoom
    // interactive: false,
  });

  const bounds = new mapboxgl.LngLatBounds();

  locations.forEach((loc) => {
    // Create marker (using marker class in our css where he designed his own marker)
    const el = document.createElement('div');
    el.className = 'marker';

    // Add marker, and then set the lnglat coordinates of it (mapbox expects [lng, lat], same as mongodb)
    new mapboxgl.Marker({
      element: el,
      anchor: 'bottom',
    })
      .setLngLat(loc.coordinates)
      .addTo(map);

    // Add popup
    new mapboxgl.Popup({
      offset: 30,
    })
      .setLngLat(loc.coordinates)
      .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`)
      .addTo(map);

    // Extend map bounds to include current location
    // this 'extends' our bounds (i.e. makes the map define its location that it renders based on the multiple markers it creates here...i.e. so they can all be viewed)
    bounds.extend(loc.coordinates);
  });

  // make it so the map actually fits the bounds
  map.fitBounds(bounds, {
    padding: {
      top: 200, // 200px
      bottom: 150,
      left: 100,
      right: 100,
    },
  });
};
