import json
import urllib.request

url = "https://raw.githubusercontent.com/pranshumaheshwari/indian-cities-and-villages/master/data.json"
print("Downloading...")
response = urllib.request.urlopen(url)
data = json.loads(response.read().decode('utf-8'))

print("Parsing...")
maha_data = {}
for state_obj in data:
    if state_obj.get("state") == "Maharashtra":
        for dist_obj in state_obj.get("districts", []):
            dist_name = dist_obj.get("district")
            maha_data[dist_name] = {}
            for sub_obj in dist_obj.get("subDistricts", []):
                sub_name = sub_obj.get("subDistrict")
                villages = sub_obj.get("villages", [])
                maha_data[dist_name][sub_name] = villages

with open("dashboard/src/assets/json/maharashtra_full.json", "w", encoding="utf-8") as f:
    json.dump(maha_data, f, ensure_ascii=False)

print("Done! Keys:", list(maha_data.keys()))
