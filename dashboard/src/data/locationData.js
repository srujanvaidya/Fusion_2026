// India States
export const INDIA_STATES = [
  "Andaman and Nicobar Islands","Andhra Pradesh","Arunachal Pradesh","Assam",
  "Bihar","Chandigarh","Chhattisgarh","Dadra and Nagar Haveli and Daman and Diu",
  "Delhi","Goa","Gujarat","Haryana","Himachal Pradesh","Jammu and Kashmir",
  "Jharkhand","Karnataka","Kerala","Ladakh","Lakshadweep","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Puducherry",
  "Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura",
  "Uttar Pradesh","Uttarakhand","West Bengal",
];

// Districts per state (comprehensive for Maharashtra; key districts for others)
export const DISTRICTS_BY_STATE = {
  "Maharashtra": [
    "Ahmednagar","Akola","Amravati","Aurangabad","Beed","Bhandara","Buldhana",
    "Chandrapur","Dhule","Gadchiroli","Gondia","Hingoli","Jalgaon","Jalna",
    "Kolhapur","Latur","Mumbai City","Mumbai Suburban","Nagpur","Nanded",
    "Nandurbar","Nashik","Osmanabad","Palghar","Parbhani","Pune","Raigad",
    "Ratnagiri","Sangli","Satara","Sindhudurg","Solapur","Thane","Wardha",
    "Washim","Yavatmal",
  ],
  "Gujarat": ["Ahmedabad","Amreli","Anand","Aravalli","Banaskantha","Bharuch","Bhavnagar","Botad","Chhota Udaipur","Dahod","Dang","Devbhoomi Dwarka","Gandhinagar","Gir Somnath","Jamnagar","Junagadh","Kheda","Kutch","Mahisagar","Mehsana","Morbi","Narmada","Navsari","Panchmahal","Patan","Porbandar","Rajkot","Sabarkantha","Surat","Surendranagar","Tapi","Vadodara","Valsad"],
  "Karnataka": ["Bagalkot","Ballari","Belagavi","Bengaluru Rural","Bengaluru Urban","Bidar","Chamarajanagar","Chikkaballapur","Chikkamagaluru","Chitradurga","Dakshina Kannada","Davanagere","Dharwad","Gadag","Hassan","Haveri","Kalaburagi","Kodagu","Kolar","Koppal","Mandya","Mysuru","Raichur","Ramanagara","Shivamogga","Tumakuru","Udupi","Uttara Kannada","Vijayapura","Yadgir"],
  "Madhya Pradesh": ["Agar Malwa","Alirajpur","Anuppur","Ashoknagar","Balaghat","Barwani","Betul","Bhind","Bhopal","Burhanpur","Chhatarpur","Chhindwara","Damoh","Datia","Dewas","Dhar","Dindori","Guna","Gwalior","Harda","Hoshangabad","Indore","Jabalpur","Jhabua","Katni","Khandwa","Khargone","Mandla","Mandsaur","Morena","Narsinghpur","Neemuch","Panna","Raisen","Rajgarh","Ratlam","Rewa","Sagar","Satna","Sehore","Seoni","Shahdol","Shajapur","Sheopur","Shivpuri","Sidhi","Singrauli","Tikamgarh","Ujjain","Umaria","Vidisha"],
  "Andhra Pradesh": ["Alluri Sitarama Raju","Anakapalli","Ananthapuramu","Annamayya","Bapatla","Chittoor","East Godavari","Eluru","Guntur","Kakinada","Konaseema","Krishna","Kurnool","Nandyal","NTR","Palnadu","Parvathipuram Manyam","Prakasam","Sri Potti Sriramulu Nellore","Sri Sathya Sai","Srikakulam","Tirupati","Visakhapatnam","Vizianagaram","West Godavari","YSR Kadapa"],
  "Telangana": ["Adilabad","Bhadradri Kothagudem","Hanamkonda","Hyderabad","Jagtial","Jangaon","Jayashankar Bhupalpally","Jogulamba Gadwal","Kamareddy","Karimnagar","Khammam","Kumuram Bheem","Mahabubabad","Mahabubnagar","Mancherial","Medak","Medchal–Malkajgiri","Mulugu","Nagarkurnool","Nalgonda","Narayanpet","Nirmal","Nizamabad","Peddapalli","Rajanna Sircilla","Rangareddy","Sangareddy","Siddipet","Suryapet","Vikarabad","Wanaparthy","Warangal","Yadadri Bhuvanagiri"],
  "Rajasthan": ["Ajmer","Alwar","Banswara","Baran","Barmer","Bharatpur","Bhilwara","Bikaner","Bundi","Chittorgarh","Churu","Dausa","Dholpur","Dungarpur","Hanumangarh","Jaipur","Jaisalmer","Jalore","Jhalawar","Jhunjhunu","Jodhpur","Karauli","Kota","Nagaur","Pali","Pratapgarh","Rajsamand","Sawai Madhopur","Sikar","Sirohi","Sri Ganganagar","Tonk","Udaipur"],
  "Uttar Pradesh": ["Agra","Aligarh","Allahabad","Ambedkar Nagar","Amethi","Amroha","Auraiya","Ayodhya","Azamgarh","Baghpat","Bahraich","Ballia","Balrampur","Banda","Barabanki","Bareilly","Basti","Bhadohi","Bijnor","Budaun","Bulandshahr","Chandauli","Chitrakoot","Deoria","Etah","Etawah","Farrukhabad","Fatehpur","Firozabad","Gautam Buddha Nagar","Ghaziabad","Ghazipur","Gonda","Gorakhpur","Hamirpur","Hapur","Hardoi","Hathras","Jalaun","Jaunpur","Jhansi","Kannauj","Kanpur Dehat","Kanpur Nagar","Kasganj","Kaushambi","Kheri","Kushinagar","Lalitpur","Lucknow","Maharajganj","Mahoba","Mainpuri","Mathura","Mau","Meerut","Mirzapur","Moradabad","Muzaffarnagar","Pilibhit","Pratapgarh","Raebareli","Rampur","Saharanpur","Sambhal","Sant Kabir Nagar","Shahjahanpur","Shamli","Shravasti","Siddharthnagar","Sitapur","Sonbhadra","Sultanpur","Unnao","Varanasi"],
  "Bihar": ["Araria","Arwal","Aurangabad","Banka","Begusarai","Bhagalpur","Bhojpur","Buxar","Darbhanga","East Champaran","Gaya","Gopalganj","Jamui","Jehanabad","Kaimur","Katihar","Khagaria","Kishanganj","Lakhisarai","Madhepura","Madhubani","Munger","Muzaffarpur","Nalanda","Nawada","Patna","Purnia","Rohtas","Saharsa","Samastipur","Saran","Sheikhpura","Sheohar","Sitamarhi","Siwan","Supaul","Vaishali","West Champaran"],
  "Tamil Nadu": ["Ariyalur","Chengalpattu","Chennai","Coimbatore","Cuddalore","Dharmapuri","Dindigul","Erode","Kallakurichi","Kancheepuram","Kanyakumari","Karur","Krishnagiri","Madurai","Mayiladuthurai","Nagapattinam","Namakkal","Nilgiris","Perambalur","Pudukkottai","Ramanathapuram","Ranipet","Salem","Sivaganga","Tenkasi","Thanjavur","Theni","Thoothukudi","Tiruchirappalli","Tirunelveli","Tirupathur","Tiruppur","Tiruvallur","Tiruvannamalai","Tiruvarur","Vellore","Villupuram","Virudhunagar"],
  "West Bengal": ["Alipurduar","Bankura","Birbhum","Cooch Behar","Dakshin Dinajpur","Darjeeling","Hooghly","Howrah","Jalpaiguri","Jhargram","Kalimpong","Kolkata","Malda","Murshidabad","Nadia","North 24 Parganas","Paschim Bardhaman","Paschim Medinipur","Purba Bardhaman","Purba Medinipur","Purulia","South 24 Parganas","Uttar Dinajpur"],
  "Kerala": ["Alappuzha","Ernakulam","Idukki","Kannur","Kasaragod","Kollam","Kottayam","Kozhikode","Malappuram","Palakkad","Pathanamthitta","Thiruvananthapuram","Thrissur","Wayanad"],
  "Punjab": ["Amritsar","Barnala","Bathinda","Faridkot","Fatehgarh Sahib","Fazilka","Ferozepur","Gurdaspur","Hoshiarpur","Jalandhar","Kapurthala","Ludhiana","Mansa","Moga","Mohali","Muktsar","Pathankot","Patiala","Rupnagar","Sangrur","Shaheed Bhagat Singh Nagar","Tarn Taran"],
  "Haryana": ["Ambala","Bhiwani","Charkhi Dadri","Faridabad","Fatehabad","Gurugram","Hisar","Jhajjar","Jind","Kaithal","Karnal","Kurukshetra","Mahendragarh","Nuh","Palwal","Panchkula","Panipat","Rewari","Rohtak","Sirsa","Sonipat","Yamunanagar"],
  "Goa": ["North Goa","South Goa"],
  "Delhi": ["Central Delhi","East Delhi","New Delhi","North Delhi","North East Delhi","North West Delhi","Shahdara","South Delhi","South East Delhi","South West Delhi","West Delhi"],
};

// Talukas per district in Maharashtra (comprehensive)
export const TALUKAS_BY_DISTRICT = {
  // Pune
  "Pune": ["Ambegaon","Baramati","Bhor","Daund","Haveli","Indapur","Junnar","Khed","Maval","Mulshi","Purandar","Shirur","Velhe","Puné City"],
  // Nashik
  "Nashik": ["Baglan","Chandwad","Deola","Dindori","Igatpuri","Kallam","Malegaon","Nandgaon","Nashik","Niphad","Peint","Sinnar","Surgana","Trimbakeshwar","Yeola"],
  // Kolhapur
  "Kolhapur": ["Ajra","Bavda","Bhudargad","Chandgad","Gadhinglaj","Hatkanangle","Kagal","Karvir","Panhala","Radhanagari","Shahuwadi","Shirol"],
  // Solapur
  "Solapur": ["Akkalkot","Barshi","Karmala","Madha","Malshiras","Mangalvedhe","Mohol","Pandharpur","Sangole","Solapur North","Solapur South"],
  // Aurangabad
  "Aurangabad": ["Aurangabad","Gangapur","Kannad","Khuldabad","Paithan","Phulambri","Silod","Soygaon","Vaijapur"],
  // Ahmednagar
  "Ahmednagar": ["Ahmednagar","Akole","Jamkhed","Karjat","Kopargaon","Nagar","Nevasa","Parner","Pathardi","Rahata","Rahuri","Sangamner","Shevgaon","Shrigonda","Shrirampur"],
  // Nagpur
  "Nagpur": ["Bhiwapur","Hingna","Kalmeshwar","Kamptee","Katol","Kuhi","Mauda","Nagpur Rural","Nagpur Urban","Narkhed","Parseoni","Ramtek","Savner","Umred"],
  // Latur
  "Latur": ["Ahmadpur","Ausa","Chakur","Deoni","Jalkot","Latur","Nilanga","Renapur","Shirur Anantpal","Udgir"],
  // Sangli
  "Sangli": ["Atpadi","Jat","Kadegaon","Khanapur","Kavathemahankal","Miraj","Palus","Shirala","Tasgaon","Walwa"],
  // Satara
  "Satara": ["Jaoli","Karad","Khandala","Khatav","Koregaon","Mahabaleshwar","Man","Patan","Phaltan","Satara","Wai"],
  // Jalgaon
  "Jalgaon": ["Amalner","Bhadgaon","Bhusawal","Bodwad","Chalisgaon","Chopda","Dharangaon","Erandol","Jalgaon","Jamner","Muktainagar","Pachora","Parola","Raver","Yawal"],
  // Akola
  "Akola": ["Akola","Akot","Balapur","Barshitakli","Murtizapur","Patur","Telhara"],
  // Amravati
  "Amravati": ["Achalpur","Amravati","Anjangaon Surji","Bhatkuli","Chandur Bazar","Chandur Railway","Chikhaldara","Daryapur","Dhamangaon Railway","Dharni","Morshi","Nandgaon Khandeshwar","Teosa","Warud"],
  // Yavatmal
  "Yavatmal": ["Arni","Babulgaon","Darwha","Digras","Ghatanji","Kalamb","Kelapur","Mahagaon","Maregaon","Ner","Pusad","Ralegaon","Umarkhed","Wani","Yavatmal","Zari Jamani"],
  // Nanded
  "Nanded": ["Ardhapur","Bhokar","Biloli","Deglur","Dharmabad","Hadgaon","Himayatnagar","Kandhar","Kinwat","Loha","Mudkhed","Mukhed","Naigaon","Nanded","Umri"],
  // Beed
  "Beed": ["Ambejogai","Ashti","Beed","Dharur","Georai","Kaij","Keej","Manjlegaon","Parli","Patoda","Shirur Kasar","Wadwani"],
  // Wardha
  "Wardha": ["Arvi","Ashti","Deoli","Hinganghat","Karanja","Samudrapur","Seloo","Wardha"],
  // Buldhana
  "Buldhana": ["Buldana","Chikhli","Deulgaon Raja","Jalgaon Jamod","Khamgaon","Lonar","Malkapur","Mehkar","Motala","Nandura","Sangrampur","Shegaon","Sindkhed Raja"],
  // Dhule
  "Dhule": ["Dhule","Sakri","Shindkheda","Shirpur"],
  // Thane
  "Thane": ["Ambarnath","Bhiwandi","Kalyan","Murbad","Shahapur","Thane","Ulhasnagar"],
  // Raigad
  "Raigad": ["Alibag","Karjat","Khalapur","Mahad","Mangaon","Mhasla","Murud","Panvel","Pen","Poladpur","Roha","Shrivardhan","Sudhagad","Tala","Uran"],
  // Ratnagiri
  "Ratnagiri": ["Chiplun","Dapoli","Guhagar","Khed","Lanja","Mandangad","Rajapur","Ratnagiri","Sangameshwar"],
  // Sindhudurg
  "Sindhudurg": ["Deogad","Dodamarg","Kankavli","Kudal","Malvan","Sawantwadi","Vaibhavwadi","Vengurla"],
  // Palghar
  "Palghar": ["Dahanu","Jawhar","Mokhada","Palghar","Talasari","Vada","Vasai","Vikramgad","Wada"],
  // Osmanabad
  "Osmanabad": ["Bhoom","Kalamb","Lohara","Osmanabad","Paranda","Tuljapur","Umarga","Washi"],
  // Parbhani
  "Parbhani": ["Gangakhed","Jintur","Manwat","Parbhani","Pathri","Purna","Selu","Sonpeth"],
  // Hingoli
  "Hingoli": ["Aundha Nagnath","Basmath","Hingoli","Kalamnuri","Sengaon"],
  // Jalna
  "Jalna": ["Ambad","Badnapur","Bhokardan","Ghansawangi","Jafferabad","Jalna","Mantha","Partur"],
  // Nandurbar
  "Nandurbar": ["Akkalkuwa","Akrani","Nawapur","Nandurbar","Shahada","Taloda"],
  // Gadchiroli
  "Gadchiroli": ["Aheri","Armori","Bhamragad","Chamorgonda","Chamorshi","Desaiganj","Dhanora","Etapalli","Gadchiroli","Korchi","Kurkheda","Mulchera","Sironcha"],
  // Chandrapur
  "Chandrapur": ["Ballarpur","Bhadravati","Brahmapuri","Chandrapur","Chimur","Gondpipri","Jiwati","Korpana","Mul","Nagbhid","Pombhurna","Rajura","Sawali","Sindewahi","Warora"],
  // Gondia
  "Gondia": ["Amgaon","Arjuni Morgaon","Deori","Goregaon","Gondia","Sadak Arjuni","Salekasa","Tirora"],
  // Bhandara
  "Bhandara": ["Bhandara","Lakhandur","Lakhni","Mohadi","Pauni","Sakoli","Tumsar"],
  // Washim
  "Washim": ["Karanja","Malegaon","Mangrulpir","Manora","Risod","Washim"],
  // Mumbai City
  "Mumbai City": ["Mumbai City"],
  // Mumbai Suburban
  "Mumbai Suburban": ["Andheri","Borivali","Kurla"],
};

/**
 * Get districts for a given state.
 * Falls back to an empty array if the state isn't in the map.
 */
export function getDistricts(state) {
  return DISTRICTS_BY_STATE[state] || [];
}

/**
 * Get talukas for a given district (Maharashtra-specific).
 * For other states returns an empty array.
 */
export function getTalukas(district) {
  return TALUKAS_BY_DISTRICT[district] || [];
}
