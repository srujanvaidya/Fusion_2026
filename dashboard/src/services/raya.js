/**
 * Raya — in-app assistant. Runs in the browser and answers from the user's own data:
 * land records, insurance claims, crop-stress alerts (NDVI vs baseline) and live weather
 * for the exact location of the field being discussed.
 *
 * reply(message, ctx) -> Promise<{ text, actions: [{ label, to }] }>
 * ctx = { lang, profile, parcels, claims, alerts, isDemo, memory }   (memory is mutated: last field discussed)
 */
import { analyseParcel } from './earlyWarning';
import { coordsFor, DISTRICT_COORDS } from '../data/districtCoords';

const inr = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const STATUS = {
  en: { Pending: 'waiting for Gram Panchayat review', Pending_Talathi: 'waiting for Talathi verification', Approved: 'approved', Rejected: 'rejected', Processing: 'processing' },
  mr: { Pending: 'ग्रामपंचायत पडताळणी प्रलंबित', Pending_Talathi: 'तलाठी पडताळणी प्रलंबित', Approved: 'मंजूर', Rejected: 'नाकारला', Processing: 'प्रक्रियेत' },
};
const LEVEL = { en: { critical: 'critical', warning: 'a warning', watch: 'on watch', healthy: 'healthy' }, mr: { critical: 'गंभीर', warning: 'इशारा', watch: 'निरीक्षणात', healthy: 'निरोगी' } };
const CAUSE = {
  en: { drought: 'moisture/drought stress', pest: 'a possible pest or disease outbreak', generic: 'a decline below the seasonal norm' },
  mr: { drought: 'पाण्याचा ताण/दुष्काळ', pest: 'कीड किंवा रोगाचा संभाव्य प्रादुर्भाव', generic: 'हंगामी सरासरीपेक्षा घट' },
};

export const SUGGESTIONS = {
  en: ['Temperature at my land', 'NDVI of my field', 'My land record', 'My claims', 'Should I irrigate?', 'How do I file a claim?'],
  mr: ['माझ्या जमिनीचे तापमान', 'माझ्या शेताचा NDVI', 'माझी जमीन नोंद', 'माझे दावे', 'सिंचन करावे का?', 'दावा कसा दाखल करायचा?'],
};

/* Marathi <-> English place aliases so "karad" matches a record stored as कराड and vice versa. */
const ALIASES = [
  ['karad', 'कराड'], ['satara', 'सातारा'], ['pune', 'पुणे'], ['nashik', 'नाशिक'], ['kolhapur', 'कोल्हापूर'], ['solapur', 'सोलापूर'],
  ['sangli', 'सांगली'], ['nagpur', 'नागपूर'], ['latur', 'लातूर'], ['baramati', 'बारामती'], ['wai', 'वाई'], ['patan', 'पाटण'],
  ['khatav', 'खटाव'], ['koregaon', 'कोरेगाव'], ['phaltan', 'फलटण'], ['mahabaleshwar', 'महाबळेश्वर'], ['ahmednagar', 'अहमदनगर'],
  ['jalgaon', 'जळगाव'], ['amravati', 'अमरावती'], ['nanded', 'नांदेड'], ['aurangabad', 'औरंगाबाद'], ['thane', 'ठाणे'], ['raigad', 'रायगड'],
];
const expand = (s) => {
  let out = String(s || '').toLowerCase();
  ALIASES.forEach(([en, mr]) => { if (out.includes(en)) out += ' ' + mr; if (out.includes(mr)) out += ' ' + en; });
  return out;
};

const plotOf = (p) => String(p.gatNumber || p.gutNo || p.gat_no || p.plotNumber || '');
const cropOf = (p) => String(p.crop || '').split('/')[0].trim();
const pKey = (p) => p.firestoreId || p.id || `${plotOf(p)}-${p.village || ''}`;
const placeOf = (p) => [p.village, p.taluka, p.district].filter(Boolean).join(', ');
const fieldName = (p, L) => `${cropOf(p) || L('Field', 'शेत')} · ${L('Plot', 'गट')} ${plotOf(p) || '-'}${p.village ? ` (${p.village})` : ''}`;

/* ── network helpers (cached) ───────────────────────────────────────── */
const geoCache = new Map();
async function geocode(name) {
  const key = String(name).toLowerCase();
  if (geoCache.has(key)) return geoCache.get(key);
  let hit = null;
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=8&language=en&format=json`);
    const d = await r.json();
    hit = (d.results || []).find((x) => x.country_code === 'IN' && /maharashtra/i.test(x.admin1 || ''))
      || (d.results || []).find((x) => x.country_code === 'IN') || null;
    if (hit) hit = { lat: hit.latitude, lon: hit.longitude, label: [hit.name, hit.admin2 || hit.admin1].filter(Boolean).join(', '), admin1: hit.admin1 };
  } catch { /* offline */ }
  geoCache.set(key, hit);
  return hit;
}

const near = (a, b, deg = 1.3) => Math.abs(a[0] - b[0]) < deg && Math.abs(a[1] - b[1]) < deg;

/** Best-effort coordinates for a land record: saved GPS, else taluka/village geocode, else district centre. */
async function locateParcel(p) {
  if (p.lat != null && p.lng != null) return { lat: +p.lat, lon: +p.lng, label: placeOf(p) };
  const dc = DISTRICT_COORDS[p.district];
  for (const name of [p.taluka, p.village]) {
    if (!name || /[ऀ-ॿ]/.test(name)) continue; // geocoder is Latin-script
    const g = await geocode(name);
    if (g && (!dc || near([g.lat, g.lon], dc))) return { lat: g.lat, lon: g.lon, label: [g.label.split(',')[0], p.district].filter(Boolean).join(', ') };
  }
  const c = coordsFor(p.district);
  return { lat: c[0], lon: c[1], label: p.district || 'Pune' };
}

const wxCache = new Map();
async function getWeather(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = wxCache.get(key);
  if (hit && Date.now() - hit.t < 10 * 60000) return hit.v;
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation'
    + '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,et0_fao_evapotranspiration'
    + '&forecast_days=3&timezone=Asia%2FKolkata');
  const d = await r.json();
  const sum = (a) => a.reduce((s, v) => s + (v || 0), 0);
  const v = {
    temp: d.current.temperature_2m, feels: d.current.apparent_temperature, hum: d.current.relative_humidity_2m, wind: d.current.wind_speed_10m,
    rainNow: d.current.precipitation, max: d.daily.temperature_2m_max[0], min: d.daily.temperature_2m_min[0],
    rain3: sum(d.daily.precipitation_sum), pop: d.daily.precipitation_probability_max[0] ?? 0, et0: sum(d.daily.et0_fao_evapotranspiration),
  };
  wxCache.set(key, { t: Date.now(), v });
  return v;
}

/* ── understanding the message ──────────────────────────────────────── */
const GENERIC = new Set(['my', 'land', 'farm', 'field', 'the', 'there', 'here', 'what', 'whats', "what's", 'tell', 'temp', 'temperature', 'weather', 'ndvi', 'value', 'please', 'and', 'for', 'now', 'today', 'current', 'crop', 'health', 'plot', 'gat', 'claim', 'claims', 'record', 'details', 'about']);

function findParcel(m, parcels) {
  const text = expand(m);
  const digits = m.match(/\b\d{2,6}\b/g) || [];
  let best = null, bestScore = 0;
  for (const p of parcels) {
    let score = 0;
    const plot = plotOf(p);
    if (plot && digits.includes(plot)) score += 5;
    const crop = cropOf(p).toLowerCase();
    if (crop && text.includes(crop)) score += 3;
    for (const f of [p.village, p.taluka, p.district, p.ownerName]) {
      const v = expand(f).trim();
      if (v.length >= 3 && text.includes(v.split(' ')[0])) score += 3;
    }
    if (score > bestScore) { best = p; bestScore = score; }
  }
  return bestScore >= 3 ? best : null;
}

const intents = (m) => ({
  weather: /(temp|temperature|weather|rain|forecast|humid|wind|hot|cold|climate|तापमान|हवामान|पाऊस|वारा|आर्द्रता|उष्ण)/.test(m),
  ndvi: /(ndvi|vegetation|stress|health|alert|warning|satellite|greenness|how.*(crop|field|farm).*(doing|look|condition)|तणाव|आरोग्य|इशारे|उपग्रह)/.test(m),
  land: /(land record|my land|record|plot|gat\b|7\/12|8-?a|owner|area|hectare|survey|registered|village|जमीन|गट|मालक|क्षेत्र|नोंद|सातबारा)/.test(m),
  claims: /(claim|insur|compensation|payout|pmfby|दावा|विमा|भरपाई)/.test(m),
  pesticide: /(pesticid|insecticid|fungicid|chemical|medicine|which spray|spray what|कीटकनाशक|बुरशीनाशक|औषध)/.test(m),
  improve: /(improve|better|increase|boost|revive|recover|yield|healthier|grow well|सुधार|उत्पादन|वाढवा|पुनर्जीवित|चांगले)/.test(m),
  advice: /(should i|what (to|do|can)|irrigat|spray|fertili|advice|suggest|water|सल्ला|सिंचन|फवारणी|खत|पाणी)/.test(m),
  how: /(how does|how do you|explain|baseline|method|कशी काम|कसे काम)/.test(m) && /(warning|alert|ndvi|detect|stress|इशारा|तणाव)/.test(m),
  file: /(file|raise|apply|submit|new claim|how.*claim|दावा दाखल|दावा कसा|दावा करा)/.test(m),
  estimate: /(estimate|how much|payout|loss amount|भरपाई|किती)/.test(m),
  pmfby: /(pmfby|premium|deadline|document|scheme|हप्ता|मुदत|कागदपत्र|योजना)/.test(m),
  status: /(status|track|pending|approved|rejected|my claims?|स्थिती|माझे दावे)/.test(m),
  roles: /(talathi|panchayat|approval|तलाठी|पंचायत|मंजुरी)/.test(m),
  hello: /^(hi|hello|hey|namaste|help|नमस्कार|हॅलो|हाय|मदत)\b/.test(m) || /(what can you|who are you|तू कोण|काय करू शकतेस)/.test(m),
  thanks: /(thank|धन्यवाद)/.test(m),
});

/* ── section builders ───────────────────────────────────────────────── */
function landSection(p, L, isDemo) {
  const rows = [
    [L('Plot / Gat No', 'गट क्र.'), plotOf(p) || '-'],
    [L('Owner', 'मालक'), p.ownerName || '-'],
    [L('Village', 'गाव'), p.village || '-'],
    [L('Taluka', 'तालुका'), p.taluka || '-'],
    [L('District', 'जिल्हा'), p.district || '-'],
    [L('Area', 'क्षेत्र'), p.area ? `${p.area} ha` : L('not recorded', 'नोंद नाही')],
    [L('Crop', 'पीक'), cropOf(p) || L('not recorded', 'नोंद नाही')],
    [L('Land type', 'जमिनीचा प्रकार'), p.landType || '-'],
    [L('Water source', 'पाण्याचा स्रोत'), p.waterSource || '-'],
  ];
  const missing = [!p.area && L('area', 'क्षेत्र'), !cropOf(p) && L('crop', 'पीक')].filter(Boolean);
  return L('Land record', 'जमीन नोंद') + (isDemo ? L(' (demo)', ' (डेमो)') : '') + ':\n' + rows.map(([k, v]) => `• ${k}: ${v}`).join('\n')
    + (missing.length ? L(`\n\nThe ${missing.join(' and ')} is missing from this record. Add it in My Land so I can give sharper advice.`, `\n\nया नोंदीत ${missing.join(' व ')} नाही. अचूक सल्ल्यासाठी माझी जमीन मध्ये भरा.`) : '');
}

function ndviSection(p, L, mr) {
  const a = analyseParcel(p);
  const m = mr ? 'mr' : 'en';
  const stateTxt = a.level === 'healthy'
    ? L('The crop looks healthy.', 'पीक निरोगी दिसते.')
    : L(`This field is ${LEVEL.en[a.level]}, consistent with ${CAUSE.en[a.cause]}.`, `हे शेत ${LEVEL.mr[a.level]} आहे, ${CAUSE.mr[a.cause]} सारखी लक्षणे.`);
  void m;
  return L(`NDVI (satellite crop health): ${a.ndvi.toFixed(2)} now, against a normal ${a.baseline.toFixed(2)} for this stage (${a.z > 0 ? '+' : ''}${a.z} standard deviations). ${stateTxt}`,
    `NDVI (उपग्रह पीक आरोग्य): सध्या ${a.ndvi.toFixed(2)}, या टप्प्यासाठी सामान्य ${a.baseline.toFixed(2)} (${a.z > 0 ? '+' : ''}${a.z} σ). ${stateTxt}`);
}

function weatherSection(w, label, L) {
  return L(`Weather at ${label}: ${Math.round(w.temp)}°C now (feels ${Math.round(w.feels)}°C), today ${Math.round(w.min)}° to ${Math.round(w.max)}°C. Humidity ${w.hum}%, wind ${w.wind} km/h. Rain next 3 days: ${w.rain3.toFixed(1)} mm (${w.pop}% chance today).`,
    `${label} येथील हवामान: सध्या ${Math.round(w.temp)}°C (जाणवते ${Math.round(w.feels)}°C), आज ${Math.round(w.min)}° ते ${Math.round(w.max)}°C. आर्द्रता ${w.hum}%, वारा ${w.wind} किमी/तास. पुढील ३ दिवसांत पाऊस ${w.rain3.toFixed(1)} मिमी (आज ${w.pop}% शक्यता).`);
}

function adviceSection(p, w, L) {
  const a = analyseParcel(p);
  const irrig = w ? Math.max(0, w.et0 - w.rain3) : null;
  const lines = [];
  if (a.level === 'healthy') lines.push(L('Crop health is normal. Keep your usual schedule.', 'पिकाचे आरोग्य सामान्य आहे. नेहमीचे वेळापत्रक चालू ठेवा.'));
  else if (a.cause === 'pest') lines.push(L('Scout the field today at about 10 spots (underside of leaves, growing points) and call your krishi officer or Kisan Call Centre 1800-180-1551 before spraying.', 'आज सुमारे १० ठिकाणी शेताची पाहणी करा (पानांची खालची बाजू, वाढीची टोके) व फवारणीपूर्वी कृषी अधिकारी किंवा किसान कॉल सेंटर 1800-180-1551 शी बोला.'));
  else lines.push(L('This looks like moisture stress. Irrigate lightly and more often, and mulch to cut evaporation.', 'हा पाण्याचा ताण दिसतो. हलके व जास्त वेळा सिंचन करा आणि बाष्पीभवन कमी करण्यासाठी आच्छादन वापरा.'));
  if (w) {
    lines.push(irrig < 10
      ? L(`Irrigation: rain and soil balance are fine for 3 days (crops need ~${w.et0.toFixed(0)} mm, rain brings ${w.rain3.toFixed(0)} mm).`, `सिंचन: ३ दिवस पाऊस व ओलावा पुरेसा (पिकाला ~${w.et0.toFixed(0)} मिमी, पाऊस ${w.rain3.toFixed(0)} मिमी).`)
      : L(`Irrigation: crops will use ~${w.et0.toFixed(0)} mm but only ${w.rain3.toFixed(0)} mm of rain is due, so plan to irrigate.`, `सिंचन: पिकाला ~${w.et0.toFixed(0)} मिमी लागेल पण पाऊस फक्त ${w.rain3.toFixed(0)} मिमी, सिंचनाचे नियोजन करा.`));
    lines.push(w.wind < 15 && w.pop < 30
      ? L('Spraying: today is a good window (calm wind, low rain chance).', 'फवारणी: आज चांगली वेळ (वारा कमी, पावसाची शक्यता कमी).')
      : L('Spraying: avoid today, wind or rain will cause drift or wash-off.', 'फवारणी: आज टाळा, वारा/पावसामुळे औषध वाहून जाईल.'));
  }
  return L('What I would do:', 'मी काय करेन:') + '\n' + lines.map((x) => `• ${x}`).join('\n');
}


/* ── crop knowledge used for pest and improvement answers ───────────── */
const CROP_KB = [
  ['sugarcane', { pests: 'woolly aphid, early shoot borer, internode borer, white grub', tips: ['mulch with cane trash to hold moisture', 'earth up and split the nitrogen dose', 'use drip or alternate-furrow irrigation to save water'] }],
  ['soybean',   { pests: 'girdle beetle, stem fly, leaf-eating caterpillars (semilooper), whitefly (yellow mosaic)', tips: ['keep the field weed-free in the first 30 days', 'apply potash and sulphur if the soil test is low', 'irrigate at flowering and pod filling if rain fails'] }],
  ['rice',      { pests: 'stem borer, brown planthopper, leaf folder, blast disease', tips: ['maintain 2 to 5 cm standing water in the critical stages', 'split nitrogen into 3 doses', 'drain for a few days if planthopper builds up'] }],
  ['cotton',    { pests: 'pink bollworm, whitefly, aphids and jassids, thrips', tips: ['install pheromone traps for bollworm', 'avoid water stress at flowering and boll set', 'remove weeds that host sucking pests'] }],
  ['wheat',     { pests: 'aphids, termites, rust diseases', tips: ['irrigate at crown root, tillering, flowering and grain filling', 'top-dress nitrogen after the first irrigation', 'watch the leaves for rust pustules'] }],
  ['onion',     { pests: 'thrips, purple blotch, downy mildew', tips: ['light, frequent irrigation, stop 10 to 15 days before harvest', 'sulphur and potash improve bulb quality', 'avoid water on leaves late in the day'] }],
  ['tur',       { pests: 'pod borer (Helicoverpa), pod fly, wilt', tips: ['pheromone traps for pod borer', 'protective irrigation at flowering and pod filling', 'keep the field free of weeds'] }],
  ['jowar',     { pests: 'shoot fly, stem borer, fall armyworm', tips: ['thin to the right plant stand', 'one protective irrigation at boot stage', 'scout whorls for armyworm early'] }],
  ['bajra',     { pests: 'shoot fly, stem borer, downy mildew', tips: ['thin to the right plant stand', 'top-dress nitrogen when rains come', 'rogue out downy-mildew plants'] }],
  ['groundnut', { pests: 'leaf miner, tikka leaf spot, aphids, white grub', tips: ['gypsum at flowering for pod filling', 'avoid water stress at pegging', 'keep weeds down in the first 40 days'] }],
  ['grape',     { pests: 'downy mildew, powdery mildew, thrips, mealybug', tips: ['manage canopy for airflow', 'avoid wetting leaves late in the day', 'balance irrigation with the berry stage'] }],
  ['tomato',    { pests: 'fruit borer, leaf curl virus (whitefly), early blight', tips: ['stake plants and mulch', 'steady irrigation to avoid fruit cracking', 'yellow sticky traps for whitefly'] }],
];
const kbFor = (crop) => { const c = String(crop || '').toLowerCase(); return (CROP_KB.find(([k]) => c.includes(k)) || [null, null])[1]; };

function pesticideSection(p, w, L) {
  const a = analyseParcel(p);
  const crop = cropOf(p) || L('your crop', 'तुमचे पीक');
  const kb = kbFor(p.crop);
  const rain14 = null; void rain14;
  const drop = a.recentDrop.toFixed(2);
  if (a.level === 'healthy') {
    return L(`Do not spray ${crop} preventively. NDVI is ${a.ndvi.toFixed(2)} against a normal ${a.baseline.toFixed(2)}, so I see no stress signal. Unneeded sprays cost money and harm beneficial insects. Scout weekly${kb ? ` for ${kb.pests}` : ''} and spray only if you find damage at the economic threshold.`,
      `${crop} वर प्रतिबंधात्मक फवारणी करू नका. NDVI ${a.ndvi.toFixed(2)} (सामान्य ${a.baseline.toFixed(2)}) असल्याने तणावाचे संकेत नाहीत. अनावश्यक फवारणीने खर्च वाढतो व मित्र कीटक मरतात. दर आठवड्याला पाहणी करा${kb ? ` (${kb.pests})` : ''} आणि नुकसान मर्यादेपेक्षा जास्त आढळल्यासच फवारा.`);
  }
  if (a.cause === 'pest') {
    return L(`NDVI on ${crop} fell by ${drop} against normal in 30 days, an abrupt pattern that can mean a pest or disease. NDVI cannot tell which one, so confirm before you spray.\n• Scout 10 spots today${kb ? `; look for ${kb.pests}` : ''}.\n• Photograph the damage and send it to your krishi officer, or call Kisan Call Centre 1800-180-1551.\n• Use only a product labelled for ${crop} and that pest, at label dose, from a licensed dealer.\n• Spray in calm, dry weather${w ? ` (today wind is ${w.wind} km/h)` : ''} and wear gloves, mask and full sleeves.`,
      `${crop} मध्ये ३० दिवसांत NDVI सामान्यापेक्षा ${drop} ने घटला, हा अचानक बदल कीड/रोग दर्शवू शकतो. कोणता ते NDVI सांगू शकत नाही, म्हणून फवारणीपूर्वी खात्री करा.\n• आज १० ठिकाणी पाहणी करा${kb ? `; ${kb.pests} पहा` : ''}.\n• नुकसानीचे फोटो कृषी अधिकाऱ्यांना पाठवा किंवा किसान कॉल सेंटर 1800-180-1551 वर संपर्क करा.\n• फक्त ${crop} व त्या किडीसाठी लेबल असलेले औषध, लेबलनुसार मात्रेत, परवानाधारक विक्रेत्याकडून घ्या.\n• शांत, कोरड्या हवामानात फवारा${w ? ` (आज वारा ${w.wind} किमी/तास)` : ''} आणि हातमोजे, मास्क व पूर्ण बाह्यांचे कपडे वापरा.`);
  }
  return L(`Pesticide will not revive this ${crop}. The NDVI decline is gradual (${a.ndvi.toFixed(2)} vs normal ${a.baseline.toFixed(2)}), the pattern of water stress, not insects${w ? `, and only ${w.rain3.toFixed(0)} mm of rain is due in 3 days` : ''}. Fix water first: irrigate lightly and often, mulch, and hold fertiliser until moisture recovers. If you also see chewed leaves, webbing or insects when you scout${kb ? ` (${kb.pests})`: ''}, ask your krishi officer before spraying.`,
    `कीटकनाशकाने हे ${crop} सुधारणार नाही. NDVI घट हळूहळू आहे (${a.ndvi.toFixed(2)}, सामान्य ${a.baseline.toFixed(2)}), हे किडीचे नव्हे तर पाण्याच्या ताणाचे लक्षण${w ? `, आणि पुढील ३ दिवसांत फक्त ${w.rain3.toFixed(0)} मिमी पाऊस` : ''}. आधी पाणी सुधारा: हलके व जास्त वेळा सिंचन, आच्छादन, आणि ओलावा सुधारेपर्यंत खत थांबवा. पाहणीत कुरतडलेली पाने किंवा कीटक दिसल्यास${kb ? ` (${kb.pests})` : ''} फवारणीपूर्वी कृषी अधिकाऱ्यांना विचारा.`);
}

function improveSection(p, w, L) {
  const a = analyseParcel(p);
  const crop = cropOf(p) || L('your crop', 'तुमचे पीक');
  const kb = kbFor(p.crop);
  const gap = Math.max(0, a.baseline - a.ndvi);
  const lines = [];
  if (a.level === 'healthy') lines.push(L(`${crop} is on track (NDVI ${a.ndvi.toFixed(2)} vs ${a.baseline.toFixed(2)} normal). The gains now come from avoiding setbacks.`, `${crop} योग्य मार्गावर आहे (NDVI ${a.ndvi.toFixed(2)}, सामान्य ${a.baseline.toFixed(2)}). आता अडथळे टाळूनच उत्पादन वाढेल.`));
  else lines.push(L(`${crop} is ${gap.toFixed(2)} NDVI below normal, which is your biggest gap to close. The pattern points to ${CAUSE.en[a.cause]}.`, `${crop} सामान्यापेक्षा ${gap.toFixed(2)} NDVI ने कमी आहे, हीच मोठी तूट आहे. नमुना ${CAUSE.mr[a.cause]} दर्शवतो.`));
  if (w) {
    const need = Math.max(0, w.et0 - w.rain3);
    lines.push(need >= 10 ? L(`Water: crops need about ${w.et0.toFixed(0)} mm over 3 days and rain adds ${w.rain3.toFixed(0)} mm, so irrigate in the evening to cover roughly ${need.toFixed(0)} mm.`, `पाणी: ३ दिवसांत पिकाला सुमारे ${w.et0.toFixed(0)} मिमी लागते, पाऊस ${w.rain3.toFixed(0)} मिमी, म्हणून संध्याकाळी सुमारे ${need.toFixed(0)} मिमी सिंचन करा.`)
      : L(`Water: rain and soil moisture cover the next 3 days, so skip extra irrigation and save water and cost.`, `पाणी: पुढील ३ दिवस पाऊस व ओलावा पुरेसा, जास्तीचे सिंचन टाळून पाणी व खर्च वाचवा.`));
    if (w.max >= 36) lines.push(L(`Heat: ${Math.round(w.max)}°C today, so irrigate in the evening and avoid fertiliser in the midday heat.`, `उष्णता: आज ${Math.round(w.max)}°C, संध्याकाळी सिंचन करा व दुपारी खत टाळा.`));
  }
  if (kb) kb.tips.slice(0, a.level === 'healthy' ? 2 : 1).forEach((t) => lines.push(`${L('Crop tip', 'पीक टीप')}: ${t}.`));
  if (a.level !== 'healthy') lines.push(L('Re-check after the next satellite pass (about 10 days). If NDVI is still falling, document the damage with geo-tagged photos for a claim.', 'पुढील उपग्रह नोंदीनंतर (सुमारे १० दिवस) पुन्हा पाहा. NDVI अजून घसरत असल्यास दाव्यासाठी जिओ-टॅग फोटोंनी नुकसान नोंदवा.'));
  return lines.map((x) => `• ${x}`).join('\n');
}

/* ── main entry ─────────────────────────────────────────────────────── */
async function ruleReply(message, ctx) {
  const { lang, parcels = [], claims = [], alerts = [], isDemo, memory = {}, profile } = ctx;
  const mr = lang === 'mr';
  const L = (en, m) => (mr ? m : en);
  const A = (label, to) => ({ label, to });
  const out = (text, actions = []) => ({ text, actions });
  const m = String(message || '').toLowerCase().trim();
  const it = intents(m);

  if (it.thanks) return out(L('You are welcome. Ask me anything about your fields.', 'धन्यवाद. तुमच्या शेतांबद्दल काहीही विचारा.'));
  if (m.length < 3 || (it.hello && !it.weather && !it.ndvi && !it.land && !it.claims)) {
    const crit = alerts.filter((a) => a.level === 'critical');
    return out(L('Hi, I am Raya. I read your land records, insurance claims, satellite crop-health (NDVI) and live weather. Try: "temperature at my land", "NDVI of my field", "show my land record", or "should I irrigate?".', 'नमस्कार, मी रया. मी तुमच्या जमीन नोंदी, विमा दावे, उपग्रह पीक आरोग्य (NDVI) आणि थेट हवामान वाचते. विचारा: "माझ्या जमिनीचे तापमान", "माझ्या शेताचा NDVI", "माझी जमीन नोंद", "सिंचन करावे का?".')
      + (crit.length ? L(`\n\nHeads up: ${crit.length} of your fields ${crit.length > 1 ? 'are' : 'is'} in critical crop stress.`, `\n\nसूचना: तुमची ${crit.length} शेते गंभीर पीक तणावात आहेत.`) : ''));
  }

  // ── which field / place is the user talking about? ──────────────────
  const pronoun = /\b(there|that field|that land|same|it)\b|तिथे|त्या शेता|तेथे/.test(m);
  let target = findParcel(m, parcels);
  if (!target && pronoun && memory.parcelKey) target = parcels.find((p) => pKey(p) === memory.parcelKey) || null;
  if (!target && /(my (land|farm|field|plot|crop)|माझ्या (जमिन|शेत))/.test(m) && parcels.length) target = parcels[0];

  // a place that is not one of the user's records ("temperature in Wai")
  let place = null;
  if (!target && it.weather) {
    const cand = (m.match(/\b(?:in|at|near|of|for)\s+([a-zऀ-ॿ]{3,}(?:\s[a-z]{3,})?)/) || [])[1];
    const word = cand && cand.split(' ').filter((w) => !GENERIC.has(w))[0];
    if (word) place = await geocode(word);
  }
  if (!target && !place && parcels.length === 1 && (it.weather || it.ndvi || it.land || it.advice || it.pesticide || it.improve)) target = parcels[0];
  if (!target && !place && memory.parcelKey && (it.weather || it.ndvi || it.advice || it.pesticide || it.improve)) target = parcels.find((p) => pKey(p) === memory.parcelKey) || null;
  if (target) memory.parcelKey = pKey(target);

  const sections = [];
  const actions = [];
  const head = target ? `${fieldName(target, L)}${isDemo ? L(' (demo field)', ' (डेमो शेत)') : ''}` : null;

  // ── claims ──────────────────────────────────────────────────────────
  if (it.pmfby) {
    sections.push(L('PMFBY (crop insurance):\n• Farmer premium: 2% (kharif food crops/oilseeds), 1.5% (rabi), 5% (commercial/horticulture); the rest is subsidised.\n• Enrol before the notified cut-off for your crop and season (check with your bank or CSC).\n• Documents: 7/12 extract, 8A, Aadhaar, bank passbook, sowing declaration.\n• Report localized losses within 72 hours.', 'PMFBY (पीक विमा):\n• शेतकरी हप्ता: २% (खरीप अन्नधान्य/तेलबिया), १.५% (रब्बी), ५% (व्यावसायिक/फळबाग); उर्वरित अनुदानित.\n• तुमच्या पिकाच्या हंगामाची अधिसूचित अंतिम तारीख पाळा (बँक/CSC कडे तपासा).\n• कागदपत्रे: ७/१२, ८अ, आधार, बँक पासबुक, पेरणी घोषणापत्र.\n• स्थानिक नुकसान ७२ तासांत कळवा.'));
  } else if (it.file || it.estimate) {
    const tgt = target ? analyseParcel(target) : null;
    sections.push(it.estimate
      ? L('The app estimates loss as affected area (ha) x crop value per hectare x 40% damage factor. A claim above ₹10,000 is flagged PMFBY-eligible. The final payout is decided by the insurer after verification.', 'अॅप नुकसानीचा अंदाज असा काढतो: बाधित क्षेत्र (हे.) x प्रति हेक्टर पिकाचे मूल्य x ४०% नुकसान घटक. ₹१०,००० पेक्षा जास्त दावा PMFBY पात्र ठरतो. अंतिम भरपाई पडताळणीनंतर विमा कंपनी ठरवते.')
      : L('To file a claim: open Insurance, pick your parcel, choose the event and damage date, add geo-tagged photos, and submit. Gram Panchayat reviews first, then Talathi. Report localized calamities within 72 hours.', 'दावा दाखल करण्यासाठी: विमा उघडा, गट निवडा, आपत्ती व नुकसानीची तारीख निवडा, जिओ-टॅग फोटो जोडा व सबमिट करा. प्रथम ग्रामपंचायत, नंतर तलाठी पडताळणी करतात. स्थानिक आपत्ती ७२ तासांत कळवा.'));
    if (tgt && (tgt.level === 'critical' || tgt.level === 'warning')) sections.push(L(`Your ${cropOf(target) || 'crop'} on plot ${plotOf(target)} shows satellite stress (NDVI ${tgt.ndvi.toFixed(2)} vs ${tgt.baseline.toFixed(2)} normal), which supports a claim.`, `तुमच्या गट ${plotOf(target)} वरील ${cropOf(target) || 'पिकात'} उपग्रह तणाव दिसतो (NDVI ${tgt.ndvi.toFixed(2)}, सामान्य ${tgt.baseline.toFixed(2)}), जो दाव्यासाठी आधार ठरतो.`));
    actions.push(A(L('File a claim', 'दावा दाखल करा'), '/claims'));
  } else if (it.status || (it.claims && !it.weather && !it.ndvi && !it.land)) {
    if (!claims.length) sections.push(L('You have no insurance claims yet. If a field is damaged, file one within 72 hours of the event.', 'तुमचा अद्याप कोणताही विमा दावा नाही. नुकसान झाल्यास ७२ तासांत दावा दाखल करा.'));
    else {
      const by = (s) => claims.filter((c) => c.status === s).length;
      const total = claims.reduce((s, c) => s + (c.estimatedLoss || 0), 0);
      sections.push(L(`You have ${claims.length} claim${claims.length > 1 ? 's' : ''}: ${by('Pending') + by('Pending_Talathi')} in review, ${by('Approved')} approved, ${by('Rejected')} rejected. Total estimated loss ${inr(total)}.\n`, `तुमचे ${claims.length} दावे: ${by('Pending') + by('Pending_Talathi')} पडताळणीत, ${by('Approved')} मंजूर, ${by('Rejected')} नाकारले. एकूण अंदाजित नुकसान ${inr(total)}.\n`)
        + claims.slice(0, 4).map((c) => `• ${c.disasterType || L('Claim', 'दावा')} · ${cropOf(c)} · ${L('Plot', 'गट')} ${c.gatNumber || '-'} · ${inr(c.estimatedLoss)} · ${STATUS[mr ? 'mr' : 'en'][c.status] || c.status}`).join('\n'));
    }
    actions.push(A(L('Open Insurance', 'विमा उघडा'), '/claims'));
  } else if (it.roles) {
    sections.push(L('Claims go to your Gram Panchayat first for local verification, then to the Talathi who checks land records. Only after both approve is the claim forwarded for insurer settlement.', 'दावे प्रथम स्थानिक पडताळणीसाठी ग्रामपंचायतीकडे, नंतर जमीन नोंदी तपासणाऱ्या तलाठ्याकडे जातात. दोघांच्या मंजुरीनंतरच दावा विमा कंपनीकडे जातो.'));
  }

  // ── how it works ────────────────────────────────────────────────────
  if (it.how) {
    sections.push(L('Each field gets an NDVI reading about every 10 days. I compare it with that crop\'s normal seasonal range and compute a z-score: below -1 is a watch, below -1.7 a warning, below -2.5 critical. A slow decline points to drought stress, a sudden drop to pests or disease.', 'प्रत्येक शेताचा NDVI सुमारे १० दिवसांनी मिळतो. त्याची त्या पिकाच्या सामान्य हंगामी श्रेणीशी तुलना करून z-स्कोअर काढतो: -१ खाली निरीक्षण, -१.७ खाली इशारा, -२.५ खाली गंभीर. हळू घट म्हणजे दुष्काळ ताण, अचानक घट म्हणजे कीड/रोग.'));
    actions.push(A(L('Open Crop Stress Watch', 'पीक तणाव निरीक्षण'), '/stress'));
  }

  // ── land / ndvi / weather / advice for the resolved field or place ──
  if (it.land && target) { sections.push(landSection(target, L, isDemo)); actions.push(A(L('Open My Land', 'माझी जमीन'), '/land')); }
  else if (it.land && !target && !it.claims) {
    if (!parcels.length) sections.push(L('You have no registered land yet. Add it in My Land and I can read its record, weather and crop health.', 'तुमची अद्याप जमीन नोंदलेली नाही. माझी जमीन मध्ये जोडा, मग मी तिची नोंद, हवामान व पीक आरोग्य सांगेन.'));
    else {
      const area = parcels.reduce((s, p) => s + (parseFloat(p.area) || 0), 0);
      sections.push(L(`You have ${parcels.length} registered fields${area ? `, ${area.toFixed(1)} ha in total` : ''}${isDemo ? ' (demo data)' : ''}:\n`, `तुमची ${parcels.length} नोंदणीकृत शेते${area ? `, एकूण ${area.toFixed(1)} हे.` : ''}${isDemo ? ' (डेमो)' : ''}:\n`) + parcels.slice(0, 5).map((p) => `• ${fieldName(p, L)}${p.area ? ` · ${p.area} ha` : ''}`).join('\n') + L('\n\nName a crop, village or plot number for its full record.', '\n\nपूर्ण नोंदीसाठी पीक, गाव किंवा गट क्रमांक सांगा.'));
    }
    actions.push(A(L('Open My Land', 'माझी जमीन'), '/land'));
  }

  let wx = null, wxLabel = '';
  if (it.weather || it.advice || it.pesticide || it.improve) {
    try {
      const loc = place || (target ? await locateParcel(target) : (parcels[0] ? await locateParcel(parcels[0]) : null)) || { lat: coordsFor(profile?.district)[0], lon: coordsFor(profile?.district)[1], label: profile?.district || 'Pune' };
      wxLabel = loc.label;
      wx = await getWeather(loc.lat, loc.lon);
    } catch { wx = null; }
  }
  if (it.weather) {
    sections.push(wx ? weatherSection(wx, wxLabel, L) : L('I could not reach the weather service right now. Check your connection and try again.', 'सध्या हवामान सेवेशी संपर्क होऊ शकला नाही. कृपया पुन्हा प्रयत्न करा.'));
    if (!target && !place && parcels.length > 1) sections.push(L('(Showing your first field. Name a village or crop for another.)', '(पहिले शेत दाखवले आहे. दुसऱ्यासाठी गाव किंवा पीक सांगा.)'));
    actions.push(A(L('Open Weather', 'हवामान उघडा'), '/weather'));
  }
  if (it.ndvi) {
    if (target) { sections.push(ndviSection(target, L, mr)); actions.push(A(L('Crop Stress Watch', 'पीक तणाव निरीक्षण'), '/stress')); }
    else if (!parcels.length) sections.push(L('Add your land first and I will track its NDVI.', 'आधी जमीन जोडा, मग मी तिचा NDVI पाहीन.'));
    else if (!alerts.length) sections.push(L('All your fields are within their normal NDVI range.', 'तुमची सर्व शेते सामान्य NDVI श्रेणीत आहेत.'));
    else {
      sections.push(L(`${alerts.length} of your fields need attention:\n`, `तुमच्या ${alerts.length} शेतांकडे लक्ष द्या:\n`) + alerts.slice(0, 4).map((al) => `• ${al.crop} · ${L('Plot', 'गट')} ${al.plot}: NDVI ${al.ndvi.toFixed(2)} vs ${al.baseline.toFixed(2)} (${LEVEL[mr ? 'mr' : 'en'][al.level]})`).join('\n'));
      actions.push(A(L('Crop Stress Watch', 'पीक तणाव निरीक्षण'), '/stress'));
    }
  }
  if (it.pesticide) {
    const p = target || parcels[0];
    sections.push(p ? pesticideSection(p, wx, L) : L('Add your land first and I will tell you whether spraying makes sense for your crop.', 'आधी जमीन जोडा, मग फवारणी योग्य आहे का ते सांगेन.'));
  } else if (it.improve) {
    const p = target || parcels[0];
    sections.push(p ? L('To get more from this field:\n', 'या शेतातून जास्त उत्पादनासाठी:\n') + improveSection(p, wx, L) : L('Add your land first so I can tailor a plan to your crop.', 'तुमच्या पिकानुसार योजनेसाठी आधी जमीन जोडा.'));
  } else if (it.advice && !it.how) {
    if (target) sections.push(adviceSection(target, wx, L));
    else if (parcels.length) sections.push(adviceSection(parcels[0], wx, L));
    else sections.push(L('Add your land first so I can tailor advice to your crop.', 'तुमच्या पिकानुसार सल्ल्यासाठी आधी जमीन जोडा.'));
  }

  // ── nothing matched: a field was named, or fall back to the menu ───
  if (!sections.length) {
    if (target) {
      const parts = [landSection(target, L, isDemo), ndviSection(target, L, mr)];
      try { const loc = await locateParcel(target); parts.push(weatherSection(await getWeather(loc.lat, loc.lon), loc.label, L)); } catch { /* skip weather */ }
      return out(`${head}\n\n${parts.join('\n\n')}`, [A(L('Open My Land', 'माझी जमीन'), '/land'), A(L('Crop Stress Watch', 'पीक तणाव निरीक्षण'), '/stress')]);
    }
    return out(L('I did not quite get that. I can tell you the weather and temperature at your land, its NDVI crop health, its land record, your insurance claims, and whether to irrigate or spray. For example: "temperature at my land and its NDVI".', 'मला नीट समजले नाही. मी तुमच्या जमिनीचे हवामान व तापमान, NDVI पीक आरोग्य, जमीन नोंद, विमा दावे आणि सिंचन/फवारणी सल्ला देऊ शकते. उदा. "माझ्या जमिनीचे तापमान आणि NDVI".'));
  }

  const body = sections.join('\n\n');
  const uniq = actions.filter((a, i) => actions.findIndex((b) => b.to === a.to) === i);
  return out(head && (it.weather || it.ndvi || it.land || it.advice || it.pesticide || it.improve) ? `${head}\n\n${body}` : body, uniq);
}


/* ── farm data bundle sent to the language model ───────────────────── */
async function buildContext(ctx) {
  const { parcels = [], claims = [], alerts = [], isDemo, profile, memory = {} } = ctx;
  const fields = await Promise.all(parcels.slice(0, 4).map(async (p) => {
    const a = analyseParcel(p);
    let weather = null;
    try {
      const loc = await locateParcel(p);
      const w = await getWeather(loc.lat, loc.lon);
      weather = { place: loc.label, tempC: Math.round(w.temp), feelsC: Math.round(w.feels), humidityPct: w.hum, windKmh: w.wind, todayMinC: Math.round(w.min), todayMaxC: Math.round(w.max), rainNext3DaysMm: +w.rain3.toFixed(1), rainChanceTodayPct: w.pop, cropWaterUseNext3DaysMm: +w.et0.toFixed(1) };
    } catch { /* weather unavailable */ }
    return {
      focus: pKey(p) === memory.parcelKey,
      crop: cropOf(p) || null, plotNo: plotOf(p) || null, village: p.village || null, taluka: p.taluka || null, district: p.district || null,
      areaHa: parseFloat(p.area) || null, owner: p.ownerName || null, landType: p.landType || null, waterSource: p.waterSource || null,
      ndvi: { current: a.ndvi, normalForThisStage: a.baseline, deviationSigma: a.z, recentDropVsNormal30d: a.recentDrop, trendPerPass: a.trend, level: a.level, likelyCause: a.cause },
      weather,
    };
  }));
  return {
    today: new Date().toISOString().slice(0, 10),
    farmerDistrict: profile?.district || null,
    usingDemoFields: !!isDemo,
    fields,
    claims: claims.slice(0, 5).map((c) => ({ event: c.disasterType, crop: cropOf(c), plotNo: c.gatNumber, estimatedLossInr: c.estimatedLoss, status: c.status, pmfbyEligible: !!c.pmfbyEligible })),
    cropStressAlertCount: alerts.length,
  };
}

/**
 * Public entry. Always returns the rule-based answer (used as fallback and for page links),
 * plus `context`, the farm data bundle for the language model.
 */
export async function reply(message, ctx) {
  const r = await ruleReply(message, ctx);
  let context = null;
  try { context = await buildContext(ctx); } catch { /* context is optional */ }
  return { ...r, context };
}
