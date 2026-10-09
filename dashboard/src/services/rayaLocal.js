/** Offline / fallback replies when the Raya API is unreachable (no server, CORS, etc.) */

function norm(s) {
  return (s || '').toLowerCase().trim();
}

export function getLocalRayaReply(message, lang) {
  const m = norm(message);
  const mr = lang === 'mr';

  const pick = (en, mhi) => (mr ? mhi : en);

  if (/^(hi|hello|hey|namaste|नमस्कार|हॅलो|हाय)\b/.test(m) || m.length < 4) {
    return pick(
      "Hello! I'm Raya. Ask me about crop insurance (PMFBY), filing a claim, NDVI health, weather, or registering land in Guardian.",
      'नमस्कार! मी रया. पिक विमा (PMFBY), विमा दावा, NDVI आरोग्य, हवामान किंवा Guardian मध्ये जमीन नोंदणी याबद्दल विचारा.'
    );
  }
  if (/thank|धन्यवाद/.test(m)) {
    return pick("You're welcome. Good luck with the season!", 'धन्यवाद. पिकाच्या हंगामास शुभेच्छा!');
  }
  if (/insur|claim|pmfby|विमा|दावा/.test(m)) {
    return pick(
      'For crop insurance: open Insurance, start a claim with your Gat number, damage date, and geo-tagged photo if you can. Gram Panchayat reviews first, then Talathi. Keep estimates realistic.',
      'पिक विमासाठी: विमा पान उघडा, गट क्रमांक, नुकसानीची तारीख आणि शक्य असल्यास जिओ-टॅग फोटोसह दावा सुरू करा. प्रथम ग्रामपंचायत, नंतर तलाठी पडताळणी करतात.'
    );
  }
  if (/ndvi|satellite|sar|health|आरोग्य|उपग्रह/.test(m)) {
    return pick(
      'NDVI from Sentinel-2 shows greenness of the crop; SAR (Sentinel-1) helps detect water/flooding. Check AI Verification / your dashboard charts for trends.',
      'Sentinel-2 NDVI पिकाची हिरवाई दाखवतो; SAR पाणी/पूर शोधण्यास मदत करतो. AI पडताळणी किंवा डॅशबोर्डवरील आलेख पाहा.'
    );
  }
  if (/weather|rain|temperature|हवामान|पाऊस|तापमान/.test(m)) {
    return pick(
      'Use the Weather page for district-level forecast and alerts. For claims, insurers often look at official weather data near your damage date.',
      'जिल्हानिहाय अंदाज आणि सूचना हवामान पानावर पाहा. दाव्यासाठी विमा कंपनी नुकसान दिनांकाजवळच्या अधिकृत हवामानाचा आढावा घेते.'
    );
  }
  if (/land|parcel|gat|7\/12|8-?a|जमीन|गट|नोंदणी/.test(m)) {
    return pick(
      'Register each field under My Land with Gat, village, taluka, and crop. You can generate 7/12 style extracts from the parcel detail view.',
      'प्रत्येक शेतासाठी माझी जमीन मध्ये गट, गाव, तालुका आणि पीक नोंदवा. पार्सल तपशीलातून ७/१२ सारखे दस्तऐवज काढता येतात.'
    );
  }
  if (/sugar|wheat|rice|cotton|soy|onion|tur|bajra|पीक|ऊस|गहू|कापूस/.test(m)) {
    return pick(
      'Common crops in Maharashtra include sugarcane, cotton, soybean, tur, onion, and kharif/rabi cereals. Match the crop in your parcel to the season for better insurance estimates.',
      'महाराष्ट्रात ऊस, कापूस, सोयाबीन, तूर, कांदा आणि खरीफ/रबी धान्ये सामान्य. विमा अंदाजासाठी पिक हंगामाशी जुळवा.'
    );
  }
  if (/talathi|panchayat|तलाठी|पंचायत/.test(m)) {
    return pick(
      'Gram Panchayat usually reviews claims first; Talathi verifies land records. Use the Claims panel with your official role.',
      'ग्रामपंचायत प्रथम दावे पाहते; तलाठी जमीन नोंदी पडताळतात. आपल्या भूमिकेसह विमा पान वापरा.'
    );
  }

  return pick(
    "I'm here for Guardian: insurance claims, NDVI, weather, and land records. Ask something specific, or start the GEE chat service (`uvicorn` on port 8001) for full AI answers.",
    'Guardian साठी मी येथे आहे: विमा, NDVI, हवामान, जमीन नोंदी. सविस्तर प्रश्न विचारा. पूर्ण AI उत्तरांसाठी GEE सेवा पोर्ट 8001 वर चालवा.'
  );
}
