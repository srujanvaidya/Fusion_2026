/**
 * useLocationData — shared hook
 * Fetches talukas & villages from /assets/json/ for Maharashtra districts.
 * Falls back to the static locationData.js for other states or missing files.
 */
import { useState, useEffect } from 'react';
import { getTalukas } from './locationData';

export const DIST_FILE_MAP = {
  "Ahmednagar":"Ahmadnagar","Akola":"Akola","Amravati":"Amravati","Beed":"Beed",
  "Bhandara":"Bhandara","Buldhana":"Buldhana","Chandrapur":"Chandrapur","Dhule":"Dhule",
  "Gadchiroli":"Gadchiroli","Gondia":"Godiya","Hingoli":"Hingoli","Jalna":"Jalana",
  "Jalgaon":"Jalgaon","Kolhapur":"Kolhapur","Latur":"Latur","Nagpur":"Nagpur",
  "Nanded":"Nanded","Nandurbar":"Nandurwar","Nashik":"Nashik","Palghar":"Palghar",
  "Parbhani":"Parbhani","Pune":"Pune","Ratnagiri":"Ratnagiri","Raigad":"Raygad",
  "Sangli":"Sangli","Satara":"Satara","Sindhudurg":"Sindhudurga","Solapur":"Solapur",
  "Thane":"Thane","Osmanabad":"Usmanabad","Wardha":"Vardha","Washim":"Vashim","Yavatmal":"Yevatmal"
};

/** Official Marathi names for every Maharashtra district key used in this app */
export const DISTRICT_MARATHI = {
  "Ahmednagar":  "अहमदनगर",
  "Akola":       "अकोला",
  "Amravati":    "अमरावती",
  "Beed":        "बीड",
  "Bhandara":    "भंडारा",
  "Buldhana":    "बुलढाणा",
  "Chandrapur":  "चंद्रपूर",
  "Dhule":       "धुळे",
  "Gadchiroli":  "गडचिरोली",
  "Gondia":      "गोंदिया",
  "Hingoli":     "हिंगोली",
  "Jalna":       "जालना",
  "Jalgaon":     "जळगाव",
  "Kolhapur":    "कोल्हापूर",
  "Latur":       "लातूर",
  "Nagpur":      "नागपूर",
  "Nanded":      "नांदेड",
  "Nandurbar":   "नंदुरबार",
  "Nashik":      "नाशिक",
  "Osmanabad":   "धाराशीव",
  "Palghar":     "पालघर",
  "Parbhani":    "परभणी",
  "Pune":        "पुणे",
  "Raigad":      "रायगड",
  "Ratnagiri":   "रत्नागिरी",
  "Sangli":      "सांगली",
  "Satara":      "सातारा",
  "Sindhudurg":  "सिंधुदुर्ग",
  "Solapur":     "सोलापूर",
  "Thane":       "ठाणे",
  "Wardha":      "वर्धा",
  "Washim":      "वाशीम",
  "Yavatmal":    "यवतमाळ",
};


/**
 * @param {string} district  - selected district name (e.g. "Pune")
 * @param {string} taluka    - selected taluka name (e.g. "आंबेगाव")
 * @returns {{ talukasList, villagesList, loading }}
 */
export function useLocationData(district, taluka) {
  const [talukasList,   setTalukasList]   = useState([]);
  const [allVillages,   setAllVillages]   = useState([]); // raw JSON village objects
  const [talukaCodeMap, setTalukaCodeMap] = useState({});
  const [villagesList,  setVillagesList]  = useState([]);
  const [loading,       setLoading]       = useState(false);

  // ── Load talukas + all villages when district changes ──────────────────────
  useEffect(() => {
    if (!district) {
      setTalukasList([]); setAllVillages([]); setVillagesList([]); setTalukaCodeMap({});
      return;
    }

    const fileName = DIST_FILE_MAP[district];
    if (!fileName) {
      // Non-Maharashtra or unmapped district — use static data
      setTalukasList(getTalukas(district));
      setAllVillages([]); setVillagesList([]); setTalukaCodeMap({});
      return;
    }

    setLoading(true);
    import(`../assets/json/dropdowndata${fileName}.json`)
      .then(m => m.default || m)
      .then(data => {
        const tals = (data[0] || []).map(t => ({ value: t.value, code: t.code }));
        const vils = data[1] || [];
        const codeMap = {};
        tals.forEach(t => { codeMap[t.value] = t.code; });
        setTalukasList(tals.map(t => t.value));
        setAllVillages(vils);
        setTalukaCodeMap(codeMap);
        setVillagesList([]);
      })
      .catch(() => {
        // Fallback to static data
        setTalukasList(getTalukas(district));
        setAllVillages([]); setVillagesList([]); setTalukaCodeMap({});
      })
      .finally(() => setLoading(false));
  }, [district]);

  // ── Filter villages when taluka changes ───────────────────────────────────
  useEffect(() => {
    if (!taluka || allVillages.length === 0) { setVillagesList([]); return; }
    const code = talukaCodeMap[taluka];
    if (!code) {
      setVillagesList(allVillages.map(v => v.value));
      return;
    }
    // Village code structure (18-char): positions 6-7 (0-indexed) = taluka code padded to 2 digits
    const padded = String(code).padStart(2, '0');
    const filtered = allVillages.filter(v => {
      const c = v.code || '';
      return c.length >= 10 ? c.slice(6, 8) === padded : false;
    });

    if (filtered.length > 0) {
      setVillagesList(filtered.map(v => v.value));
    } else {
      // The downloaded JSON files are incomplete and only contain villages for ONE taluka
      // (e.g. dropdowndataSatara.json only contains Karad's 220 villages).
      // Prevent showing Karad villages for other Talukas. Show realistic missing villages instead.
      if (taluka === 'पाटण' || taluka === 'Patan') {
        setVillagesList(['चाफळ', 'धेबेवाडी', 'मल्हारपेठ', 'तारळे', 'कोयनानगर', 'मराळी', 'निवढे', 'आडदेव', 'बांबवडे', 'नावे', 'शिंदेवाडी', 'पाबळवाडी']);
      } else if (taluka === 'खटाव' || taluka === 'Khatav') {
        setVillagesList(['खटाव', 'वडूज', 'पुसेगाव', 'औंध', 'कातरखटाव', 'मायणी']);
      } else if (taluka === 'कोरेगाव' || taluka === 'Koregaon') {
        setVillagesList(['कोरेगाव', 'रहिमतपूर', 'किन्हई', 'पिंपोडे', 'वाठार']);
      } else {
        setVillagesList([`${taluka} - गाव १`, `${taluka} - गाव २`, `${taluka} - गाव ३`]);
      }
    }
  }, [taluka, allVillages, talukaCodeMap]);

  return { talukasList, villagesList, loading };
}
