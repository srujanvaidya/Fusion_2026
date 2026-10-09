/** District centre points [lat, lon] used for weather lookups and map placement. */
export const DISTRICT_COORDS = {
  Pune: [18.52, 73.86], Nashik: [20.0, 73.79], Kolhapur: [16.7, 74.24], Solapur: [17.68, 75.9],
  Aurangabad: [19.88, 75.34], Nagpur: [21.15, 79.09], Latur: [18.4, 76.58], Amravati: [20.93, 77.75],
  Sangli: [16.86, 74.57], Nanded: [19.17, 77.32], Satara: [17.68, 74.0], Ahmednagar: [19.1, 74.74],
  Jalgaon: [21.0, 75.56], Dhule: [20.9, 74.78], Raigad: [18.51, 73.18], Thane: [19.22, 72.98],
  Yavatmal: [20.39, 78.12], Wardha: [20.74, 78.6], Beed: [18.99, 75.76], Akola: [20.71, 77.0],
  Buldhana: [20.53, 76.18], Jalna: [19.84, 75.89], Parbhani: [19.27, 76.77], Osmanabad: [18.18, 76.04],
};
export const coordsFor = (district) => DISTRICT_COORDS[district] || DISTRICT_COORDS.Pune;
