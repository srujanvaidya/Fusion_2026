import { useState, useEffect } from 'react';
import { getTalukas } from './locationData';
import { DIST_FILE_MAP } from './useLocationData';

export function useFullLocationData(district, taluka) {
  const [talukasList, setTalukasList] = useState([]);
  const [villagesList, setVillagesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [districtData, setDistrictData] = useState(null);

  useEffect(() => {
    if (!district) {
      setTalukasList([]); setVillagesList([]); setDistrictData(null);
      return;
    }

    const fileName = DIST_FILE_MAP[district] || district;
    
    setLoading(true);
    import('../assets/json/maharashtra_full.json')
      .then(m => m.default || m)
      .then(fullData => {
        const dData = fullData[fileName];
        if (dData) {
          setDistrictData(dData);
          setTalukasList(Object.keys(dData));
          setVillagesList([]);
        } else {
          setTalukasList(getTalukas(district));
          setVillagesList([]);
          setDistrictData(null);
        }
      })
      .catch(err => {
        console.error("Failed to load full location data:", err);
        setTalukasList(getTalukas(district));
        setVillagesList([]);
        setDistrictData(null);
      })
      .finally(() => setLoading(false));
  }, [district]);

  useEffect(() => {
    if (!taluka || !districtData) {
      setVillagesList([]);
      return;
    }
    const vils = districtData[taluka] || [];
    // Sort villages alphabetically for better UX
    setVillagesList([...vils].sort());
  }, [taluka, districtData]);

  return { talukasList, villagesList, loading };
}
