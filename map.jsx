import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const VILNIUS_CENTER = [54.6872, 25.2797];

function MyMap() {
  return (
    <MapContainer center={VILNIUS_CENTER} zoom={13}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={VILNIUS_CENTER}>
        <Popup>Gediminas Tower: Example Pin</Popup>
      </Marker>
    </MapContainer>
  );
}
