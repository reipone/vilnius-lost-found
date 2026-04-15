import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDistanceToNow } from 'date-fns';
import { lt } from 'date-fns/locale'; // Lithuanian language support!
import "./styles/popup.css";

// 1. IMPORT SUPABASE (Make sure supabaseClient.js exists in the same folder!)
import { supabase } from './supabaseClient';

import L from 'leaflet';
import keyIcon from "./marker-keys.svg";

let DefaultIcon = L.icon({
    iconUrl: keyIcon,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- COMPONENT: Centers already saved pins when clicked ---
function CenteringMarker({ item }) {
  const map = useMap(); 

  return (
    <Marker 
      position={[item.lat, item.lng]}
      eventHandlers={{
        click: () => {
          map.setView([item.lat, item.lng], 15, { animate: true });
        },
      }}
    >
      <Popup minWidth={200} autoPan={false}>
        <div style={{ textAlign: 'center' }}>
          {/* Note: Supabase uses item.image_url */}
          {item.image_url && (
            <img 
              src={item.image_url} 
              alt="Found item" 
              style={{ width: '100%', borderRadius: '8px', marginBottom: '8px' }} 
            />
          )}
          <p><strong>Aprašymas:</strong> {item.description}</p>
          <hr />
          <small>
            {/* Note: Supabase uses item.created_at */}
            Rasta {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: lt }) : 'Ką tik'}
          </small>
        </div>
      </Popup>
    </Marker>
  );
}

// --- COMPONENT: This listens for clicks and adds NEW pins ---
function LocationMarker({ onSave }) {
  const [position, setPosition] = useState(null);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);

  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const newItem = {
      lat: position.lat,
      lng: position.lng,
      description: description,
      // FIXED: We must send the RAW file to App.jsx so Supabase can upload it!
      imageFile: image 
    };

    onSave(newItem); 
    setPosition(null);
    setDescription("");
    setImage(null);
  };

  return position === null ? null : (
    <Marker position={position}>
      <Popup>
        <form onSubmit={handleSubmit}>
          <textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            placeholder="Radau!"
            required 
          />
          {/* FIXED: Removed the double slash in accept="image/*" */}
        {/* The Custom File Upload Wrapper */}
          <div className="file-upload-container">
            
            {/* 1. The visible button (which is actually a label) */}
            <label htmlFor="photo-upload" className="custom-file-label">
              Pridėti nuotrauką
            </label>
            
            {/* 2. The HIDDEN default browser input */}
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files[0])}
              required
              style={{ display: 'none' }} /* This makes the ugly button vanish! */
            />

            {/* 3. The custom text to show the file name */}
            <span className="file-name-display">
              {image ? image.name : "Nepasirinktas failas"}
            </span>
            
          </div>
          <button type="submit">Pasidalink</button>
        </form>
      </Popup>
    </Marker>
  );
}

// --- COMPONENT: Flies the map to the user's location ---
function MapAutoCenter({ position }) {
  const map = useMap();
  
  useEffect(() => {
    if (position) {
      // 15 is the zoom level. Higher = closer!
      map.flyTo(position, 15, { animate: true }); 
    }
  }, [position, map]);
  
  return null;
}
// --- MAIN APP ---
function App() {
  const [savedItems, setSavedItems] = useState([]);
  const [isUploading, setIsUploading] = useState(false); 
  const [userLocation, setUserLocation] = useState(null); // NEW: State for user location
  const VILNIUS_CENTER = [54.6872, 25.2797];

  useEffect(() => {
    fetchPins();

    // Ask the browser for the user's location
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // If they click "Allow", save their coordinates!
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.log("User denied location or error:", error);
          // If they hit "Block", it just stays quietly on the Vilnius center
        }
      );
    }
  }, []);

  const fetchPins = async () => {
    const { data, error } = await supabase
      .from('pins')
      .select('*');
    
    if (error) console.error("Error fetching pins:", error);
    else setSavedItems(data);
  };

  const handleNewItem = async (newItem) => {
    setIsUploading(true);
    let finalImageUrl = null;

    if (newItem.imageFile) {
      const fileExt = newItem.imageFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`; 
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(filePath, newItem.imageFile);

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('item-images')
          .getPublicUrl(filePath);
        finalImageUrl = urlData.publicUrl;
      } else {
        console.error("Image upload failed:", uploadError);
      }
    }

    const { data, error } = await supabase
      .from('pins')
      .insert([
        {
          lat: newItem.lat,
          lng: newItem.lng,
          description: newItem.description,
          image_url: finalImageUrl
        }
      ])
      .select(); 

    if (error) {
      console.error("Error saving pin:", error);
    } else if (data) {
      setSavedItems((prevItems) => [...prevItems, data[0]]);
    }
    
    setIsUploading(false);
  };

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      {isUploading && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, background: '#C6FF00', color: '#1B5E20', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold' }}>
          Saving to Vilnius...
        </div>
      )}
      
      <MapContainer center={VILNIUS_CENTER} zoom={13} style={{ height: "100%", width: "100%" }}>
        {/* FIXED: Brought your Jawg map style back! */}
        <TileLayer
          attribution='&copy; <a href="http://jawg.io" target="_blank">&copy; Jawg</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
          url={`https://tile.jawg.io/jawg-streets/{z}/{x}/{y}{r}.png?access-token=KbrM8q1XLTrpk8k9yElEOIpbFu8uj9tDE9NyZYY8eef3Zyzw9erKtPqZBnlBvlnB`}
        />
        
        /* Tell the map to fly to the user if we find them */
        <MapAutoCenter position={userLocation} />

        <LocationMarker onSave={handleNewItem} />

        {savedItems.map((item) => (
          // Make sure we use a unique key. Supabase provides 'id' automatically.
          <CenteringMarker key={item.id || Math.random()} item={item} />
        ))}
      </MapContainer>
    </div>
  );
}

export default App;