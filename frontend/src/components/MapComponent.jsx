import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon issue with React
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetinaUrl,
  iconUrl: iconUrl,
  shadowUrl: shadowUrl,
});

const MapComponent = ({ locations }) => {
  if (!locations || locations.length === 0) return null;

  // Center the map on the first location
  const center = [locations[0].lat, locations[0].lng];

  return (
    <div className="w-full h-64 md:h-80 rounded-2xl overflow-hidden mt-8 shadow-sm border border-[#eadfd4]">
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {locations.map((loc, index) => (
          <Marker key={index} position={[loc.lat, loc.lng]}>
            <Popup>{loc.name}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
