#!/usr/bin/env python3
"""
Guardian — Google Earth Engine FastAPI Microservice
Replaces Copernicus Sentinel Hub with GEE Python API.

Startup:
    uvicorn main:app --reload --host 0.0.0.0 --port 8001

Endpoint:
    POST /api/analyze   { "gat_no": "<Plot No>" }
"""

import json
import math
import os
import re
import csv
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from pathlib import Path

import ee
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai

# Setup Gemini
genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))  # set GEMINI_API_KEY in the environment; never commit keys

# ─────────────────────────────────────────────────────────────────────────────
# Config / Paths
# ─────────────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent          # SkyCrop-main/
SA_KEY   = BASE_DIR / "gen-lang-client-0176527990-583fbbd5ef83.json"  # GEE service-account key
CSV_PATH = BASE_DIR / "dashboard" / "src" / "pages" / "data" / "land_satara.csv"


# ─────────────────────────────────────────────────────────────────────────────
# UTM Zone 43N → WGS84 (same math as sentinel_pipeline.py)
# ─────────────────────────────────────────────────────────────────────────────
def utm43n_to_wgs84(easting: float, northing: float):
    """Convert UTM Zone 43N metre coordinates to (lon, lat) in WGS84."""
    a, f = 6_378_137.0, 1 / 298.257_223_563
    b    = a * (1 - f)
    e2   = 1 - (b / a) ** 2
    k0   = 0.9996
    E0   = 500_000
    lon0 = math.radians(42 * 6 - 180 + 3)  # Zone 43 central meridian = 75°E

    M  = northing / k0
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    mu = M / (a * (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256))

    p1 = (mu
          + (3*e1/2  - 27*e1**3/32)  * math.sin(2*mu)
          + (21*e1**2/16 - 55*e1**4/32) * math.sin(4*mu)
          + (151*e1**3/96) * math.sin(6*mu))

    sp, cp = math.sin(p1), math.cos(p1)
    N1 = a / math.sqrt(1 - e2*sp**2)
    T1 = math.tan(p1) ** 2
    C1 = e2 * cp**2 / (1 - e2)
    R1 = a * (1 - e2) / (1 - e2*sp**2)**1.5
    D  = (easting - E0) / (N1 * k0)

    lat_rad = p1 - (N1*math.tan(p1)/R1) * (
        D**2/2
        - (5 + 3*T1 + 10*C1 - 4*C1**2 - 9*e2) * D**4/24
        + (61 + 90*T1 + 298*C1 + 45*T1**2 - 252*e2 - 3*C1**2) * D**6/720
    )
    lon_rad = lon0 + (
        D
        - (1 + 2*T1 + C1) * D**3/6
        + (5 - 2*C1 + 28*T1 - 3*C1**2 + 8*e2 + 24*T1**2) * D**5/120
    ) / cp

    return math.degrees(lon_rad), math.degrees(lat_rad)  # (lon, lat)


def wkt_to_ee_polygon(wkt: str) -> ee.Geometry.Polygon:
    """
    Parse a WKT MULTIPOLYGON/POLYGON (UTM 43N) and return an ee.Geometry.Polygon.
    Coords extracted as raw UTM (E, N) pairs then converted to WGS84 (lon, lat).
    """
    numbers = [float(x) for x in re.findall(r"-?\d+\.?\d*(?:e[+-]?\d+)?", wkt)]
    if len(numbers) < 4:
        raise ValueError(f"Cannot parse WKT: {wkt[:80]}")

    # Build [lon, lat] ring from alternating E,N pairs
    ring = []
    for i in range(0, len(numbers) - 1, 2):
        lon, lat = utm43n_to_wgs84(numbers[i], numbers[i + 1])
        ring.append([round(lon, 7), round(lat, 7)])

    # Sanity-check: Maharashtra bounding box
    lons = [c[0] for c in ring]
    lats = [c[1] for c in ring]
    if not (72 < min(lons) and max(lons) < 81 and 15 < min(lats) and max(lats) < 22):
        raise ValueError(f"Polygon outside Maharashtra bbox: lon={lons[:2]} lat={lats[:2]}")

    return ee.Geometry.Polygon([ring])


# ─────────────────────────────────────────────────────────────────────────────
# GEE Processing helpers
# ─────────────────────────────────────────────────────────────────────────────
def _mask_s2_clouds(image: ee.Image) -> ee.Image:
    """Mask Sentinel-2 clouds using the QA60 band."""
    qa        = image.select("QA60")
    cloud_bit = 1 << 10
    cirrus_bit= 1 << 11
    mask = qa.bitwiseAnd(cloud_bit).eq(0).And(qa.bitwiseAnd(cirrus_bit).eq(0))
    return image.updateMask(mask).divide(10_000)  # scale to [0,1] reflectance


def fetch_gee_metrics(geometry: ee.Geometry, days: int = 15) -> dict:
    """
    Pull Mean NDVI (Sentinel-2) and Mean SAR VV (Sentinel-1) from GEE
    for the past `days` days over `geometry`.
    Returns dict with 'ndvi' and 'sar' keys (float or None).
    """
    today      = datetime.utcnow()
    end_date   = today.strftime("%Y-%m-%d")
    start_date = (today - timedelta(days=days)).strftime("%Y-%m-%d")

    # ── Sentinel-2 NDVI ────────────────────────────────────────────────────
    s2 = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(geometry)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 80))
        .map(_mask_s2_clouds)
    )

    def add_ndvi(img):
        ndvi = img.normalizedDifference(["B8", "B4"]).rename("NDVI")
        return img.addBands(ndvi)


    ndvi_image = s2.map(add_ndvi).select("NDVI").median()

    ndvi_stats = ndvi_image.reduceRegion(
        reducer    = ee.Reducer.mean(),
        geometry   = geometry,
        scale      = 10,
        maxPixels  = 1e9,
        bestEffort = True,
    )

    # ── Sentinel-1 SAR VV ──────────────────────────────────────────────────
    s1 = (
        ee.ImageCollection("COPERNICUS/S1_GRD")
        .filterBounds(geometry)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
        .filter(ee.Filter.eq("instrumentMode", "IW"))
        .select("VV")
    )

    sar_image  = s1.mean()
    sar_stats  = sar_image.reduceRegion(
        reducer    = ee.Reducer.mean(),
        geometry   = geometry,
        scale      = 10,
        maxPixels  = 1e9,
        bestEffort = True,
    )

    # ── Single .getInfo() round-trip ───────────────────────────────────────
    combined = ee.Dictionary({
        "ndvi": ndvi_stats.get("NDVI"),
        "sar" : sar_stats.get("VV"),
    })
    result = combined.getInfo()          # ← magic bridge: GEE → Python

    return {
        "ndvi": float(result["ndvi"]) if result.get("ndvi") is not None else None,
        "sar" : float(result["sar"])  if result.get("sar")  is not None else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Synthetic ML classifier (threshold-based, hackathon-grade)
# ─────────────────────────────────────────────────────────────────────────────
def classify(ndvi: float | None, sar: float | None) -> tuple[str, float]:
    """
    Returns (status, confidence).
    Priority: Flood > Drought > Healthy
    Fallback values are used when one signal is unavailable.
    """
    # Use conservative defaults when a sensor has no data
    sar_val  = sar  if sar  is not None else -12.0
    ndvi_val = ndvi if ndvi is not None else 0.35

    if sar_val < -18.0:
        return "Flood",   0.92
    if ndvi_val < 0.25:
        return "Drought", 0.88
    return "Healthy", 0.95


# ─────────────────────────────────────────────────────────────────────────────
# CSV index (loaded once at startup)
# ─────────────────────────────────────────────────────────────────────────────
# We build a dict: plot_no → row_dict for O(1) lookups
_parcel_index: dict[str, dict] = {}


def _load_csv():
    global _parcel_index
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV not found: {CSV_PATH}")

    print(f"[Guardian] Loading parcel index from {CSV_PATH} …")
    with open(CSV_PATH, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            key = str(row.get("Plot No", "")).strip()
            if key:
                _parcel_index.setdefault(key, row)   # keep first occurrence

    print(f"[Guardian] {len(_parcel_index):,} unique Plot No entries indexed.")


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: authenticate GEE with service-account key, load CSV index.
    """
    # 1. Earth Engine auth
    if not SA_KEY.exists():
        raise FileNotFoundError(
            f"GEE service-account key not found: {SA_KEY}\n"
            "Place your downloaded JSON key there and restart."
        )
    credentials = ee.ServiceAccountCredentials(
        email   = None,   # read from key file
        key_file= str(SA_KEY),
    )
    # The ServiceAccountCredentials constructor auto-reads client_email from the file
    # We explicitly pass it for clarity:
    with open(SA_KEY) as kf:
        sa_info = json.load(kf)

    credentials = ee.ServiceAccountCredentials(
        email   = sa_info["client_email"],
        key_file= str(SA_KEY),
    )
    ee.Initialize(credentials, opt_url="https://earthengine.googleapis.com")
    print(f"[Guardian] ✅ Google Earth Engine initialised as {sa_info['client_email']}")

    # 2. CSV index
    _load_csv()

    yield   # app is now running

    print("[Guardian] Shutting down.")


app = FastAPI(
    title       = "Guardian GEE Microservice",
    description = "Real-time disaster detection via Google Earth Engine",
    version     = "2.0.0",
    lifespan    = lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],   # tighten in production
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Request / Response schemas
# ─────────────────────────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    gat_no: str


class AnalyzeResponse(BaseModel):
    gat_no      : str
    owner_name  : str
    village     : str
    taluka      : str
    district    : str
    area_ha     : float
    lat         : float | None
    lon         : float | None
    status      : str
    confidence  : float
    current_ndvi: float | None
    current_sar : float | None
    analysis_window_days: int = 15


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/", tags=["health"])
def root():
    return {"service": "Guardian GEE Microservice", "status": "online"}


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "gee": "authenticated"}


@app.post("/api/analyze", response_model=AnalyzeResponse, tags=["analyze"])
def analyze(payload: AnalyzeRequest):
    """
    Accepts a gat_no (Plot No), fetches real-time GEE satellite data,
    and returns a disaster-classification result.
    """
    gat_no = payload.gat_no.strip()

    # ── 1. Look up parcel ──────────────────────────────────────────────────
    row = _parcel_index.get(gat_no)
    if row is None:
        raise HTTPException(status_code=404, detail=f"gat_no '{gat_no}' not found in CSV")

    owner_name = (row.get("Owner Name") or "").strip()
    village    = (row.get("Village")    or "").strip()
    taluka     = (row.get("Taluka")     or "").strip()
    district   = (row.get("District")  or "").strip()
    try:
        area_ha = float(row.get("Area (Hectares)") or 0)
    except ValueError:
        area_ha = 0.0

    wkt = (row.get("Coordinates (WKT)") or "").strip()
    if not wkt:
        raise HTTPException(status_code=422, detail=f"No WKT geometry for gat_no '{gat_no}'")

    # ── 2. Parse WKT → ee.Geometry.Polygon + centroid ────────────────────
    try:
        geometry = wkt_to_ee_polygon(wkt)
        # Compute centroid from the raw number pairs (no extra GEE call needed)
        nums = [float(x) for x in re.findall(r"-?\d+\.?\d*(?:e[+-]?\d+)?", wkt)]
        ring_lons, ring_lats = [], []
        for i in range(0, len(nums) - 1, 2):
            lo, la = utm43n_to_wgs84(nums[i], nums[i+1])
            ring_lons.append(lo); ring_lats.append(la)
        centroid_lat = round(sum(ring_lats) / len(ring_lats), 6) if ring_lats else None
        centroid_lon = round(sum(ring_lons) / len(ring_lons), 6) if ring_lons else None
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Geometry parse error: {exc}")

    # ── 3. Fetch GEE metrics ───────────────────────────────────────────────
    try:
        metrics = fetch_gee_metrics(geometry, days=15)
    except ee.EEException as exc:
        raise HTTPException(status_code=502, detail=f"GEE error: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Satellite fetch failed: {exc}")

    ndvi = metrics["ndvi"]
    sar  = metrics["sar"]

    # ── 4. Classify ────────────────────────────────────────────────────────
    status, confidence = classify(ndvi, sar)

    return AnalyzeResponse(
        gat_no       = gat_no,
        owner_name   = owner_name,
        village      = village,
        taluka       = taluka,
        district     = district,
        area_ha      = area_ha,
        lat          = centroid_lat,
        lon          = centroid_lon,
        status       = status,
        confidence   = confidence,
        current_ndvi = round(ndvi, 6) if ndvi is not None else None,
        current_sar  = round(sar,  4) if sar  is not None else None,
    )

class ChatRequest(BaseModel):
    message: str
    history: list = []

@app.post("/api/chat")
async def chat_with_raya(req: ChatRequest):
    try:
        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash-lite",
            system_instruction="You are Raya, an AI chatbot for Guardian. Guardian is a satellite-backed crop verification and insurance platform in Maharashtra, India. You assist farmers, field officers, and Talathis. You know about NDVI, SAR, crop insurance claims, temperature, and seeds. Answer concisely and kindly."
        )
        formatted_history = []
        for msg in req.history:
            role = "user" if msg.get("role") == "user" else "model"
            formatted_history.append({"role": role, "parts": [msg.get("content")]})
            
        chat = model.start_chat(history=formatted_history)
        response = chat.send_message(req.message)
        return {"reply": response.text}
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return {"reply": "I'm currently unable to reach my satellite uplink to process your request. Please try again later."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
