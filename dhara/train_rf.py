"""
Dhara Agri-Intelligence Platform - Round 1
Crop Recommendation ML Pipeline using Random Forest Classifier
"""

import sys
import numpy as np

def generate_synthetic_crop_data(n_samples=2200):
    """
    Generates synthetic agro-climatic training data based on standard
    Indian agricultural agronomy benchmarks (ICAR guidelines).
    """
    np.random.seed(42)
    crops = [
        'rice', 'maize', 'chickpea', 'kidneybeans', 'pigeonpeas',
        'mothbeans', 'mungbean', 'blackgram', 'lentil', 'pomegranate',
        'banana', 'mango', 'grapes', 'watermelon', 'muskmelon',
        'apple', 'orange', 'papaya', 'coconut', 'cotton', 'jute', 'coffee'
    ]
    
    samples_per_crop = n_samples // len(crops)
    data = []
    
    crop_profiles = {
        'rice':        {'N': (80, 100),  'P': (35, 55),  'K': (35, 45),  'temp': (21, 27), 'hum': (80, 95), 'ph': (6.0, 7.0), 'rain': (190, 280)},
        'maize':       {'N': (60, 85),   'P': (35, 50),  'K': (15, 25),  'temp': (18, 25), 'hum': (55, 70), 'ph': (5.8, 6.8), 'rain': (60, 110)},
        'chickpea':    {'N': (20, 45),   'P': (55, 80),  'K': (75, 85),  'temp': (17, 22), 'hum': (14, 22), 'ph': (6.8, 7.8), 'rain': (65, 80)},
        'kidneybeans': {'N': (15, 35),   'P': (55, 75),  'K': (15, 25),  'temp': (15, 23), 'hum': (50, 60), 'ph': (5.5, 6.0), 'rain': (100, 150)},
        'pigeonpeas':  {'N': (18, 38),   'P': (55, 75),  'K': (18, 25),  'temp': (27, 36), 'hum': (40, 65), 'ph': (4.8, 7.0), 'rain': (90, 190)},
        'mothbeans':   {'N': (15, 35),   'P': (35, 55),  'K': (15, 25),  'temp': (24, 32), 'hum': (40, 60), 'ph': (3.5, 9.5), 'rain': (30, 75)},
        'mungbean':    {'N': (15, 35),   'P': (35, 55),  'K': (15, 25),  'temp': (27, 30), 'hum': (80, 90), 'ph': (6.2, 7.2), 'rain': (35, 60)},
        'blackgram':   {'N': (35, 55),   'P': (55, 75),  'K': (15, 25),  'temp': (25, 35), 'hum': (60, 70), 'ph': (6.5, 7.5), 'rain': (60, 75)},
        'lentil':      {'N': (15, 35),   'P': (55, 75),  'K': (15, 25),  'temp': (18, 28), 'hum': (60, 70), 'ph': (6.8, 7.8), 'rain': (35, 55)},
        'pomegranate': {'N': (15, 35),   'P': (10, 25),  'K': (35, 45),  'temp': (18, 25), 'hum': (85, 95), 'ph': (5.5, 7.2), 'rain': (100, 115)},
        'banana':      {'N': (95, 120),  'P': (70, 95),  'K': (45, 55),  'temp': (25, 30), 'hum': (75, 85), 'ph': (5.8, 6.8), 'rain': (90, 115)},
        'mango':       {'N': (15, 35),   'P': (15, 35),  'K': (25, 35),  'temp': (27, 36), 'hum': (45, 55), 'ph': (4.5, 7.0), 'rain': (88, 102)},
        'grapes':      {'N': (15, 35),   'P': (120, 145),'K': (190, 210),'temp': (8, 42),  'hum': (80, 85), 'ph': (5.5, 6.5), 'rain': (65, 75)},
        'watermelon':  {'N': (80, 110),  'P': (10, 25),  'K': (45, 55),  'temp': (24, 27), 'hum': (80, 90), 'ph': (6.0, 7.0), 'rain': (40, 60)},
        'muskmelon':   {'N': (85, 115),  'P': (10, 25),  'K': (45, 55),  'temp': (27, 30), 'hum': (90, 95), 'ph': (6.0, 6.8), 'rain': (20, 30)},
        'apple':       {'N': (15, 35),   'P': (120, 145),'K': (190, 210),'temp': (21, 24), 'hum': (90, 95), 'ph': (5.5, 6.5), 'rain': (100, 125)},
        'orange':      {'N': (15, 35),   'P': (10, 25),  'K': (5, 15),   'temp': (11, 35), 'hum': (90, 95), 'ph': (6.0, 7.5), 'rain': (100, 115)},
        'papaya':      {'N': (45, 65),   'P': (55, 75),  'K': (45, 55),  'temp': (33, 44), 'hum': (90, 95), 'ph': (6.5, 7.0), 'rain': (140, 250)},
        'coconut':     {'N': (15, 35),   'P': (10, 25),  'K': (25, 35),  'temp': (25, 30), 'hum': (90, 98), 'ph': (5.5, 6.5), 'rain': (130, 225)},
        'cotton':      {'N': (110, 135), 'P': (40, 55),  'K': (15, 25),  'temp': (23, 26), 'hum': (55, 85), 'ph': (6.0, 8.0), 'rain': (60, 95)},
        'jute':        {'N': (75, 95),   'P': (40, 55),  'K': (35, 45),  'temp': (23, 26), 'hum': (70, 90), 'ph': (6.0, 7.5), 'rain': (150, 200)},
        'coffee':      {'N': (90, 115),  'P': (25, 40),  'K': (25, 35),  'temp': (23, 28), 'hum': (55, 65), 'ph': (6.0, 7.2), 'rain': (150, 190)},
    }
    
    rows = []
    for c in crops:
        prof = crop_profiles.get(c, {'N': (50, 90), 'P': (30, 60), 'K': (30, 60), 'temp': (20, 28), 'hum': (50, 80), 'ph': (6.0, 7.5), 'rain': (70, 150)})
        for _ in range(samples_per_crop):
            n = np.random.uniform(*prof['N'])
            p = np.random.uniform(*prof['P'])
            k = np.random.uniform(*prof['K'])
            temp = np.random.uniform(*prof['temp'])
            hum = np.random.uniform(*prof['hum'])
            ph = np.random.uniform(*prof['ph'])
            rain = np.random.uniform(*prof['rain'])
            rows.append([n, p, k, temp, hum, ph, rain, c])
            
    import pandas as pd
    df = pd.DataFrame(rows, columns=['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall', 'label'])
    return df

def train_model():
    print("[Dhara ML] Initializing Random Forest model training...")
    try:
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import accuracy_score, classification_report
    except ImportError:
        print("[!] scikit-learn is not installed. Run: pip install scikit-learn pandas")
        return

    df = generate_synthetic_crop_data()
    X = df[['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']]
    y = df['label']

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=14,
        min_samples_split=4,
        min_samples_leaf=1,
        random_state=42
    )

    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)

    print(f"[+] Random Forest Training Complete!")
    print(f"[+] Total Dataset Size : {len(df)} records across 22 crops")
    print(f"[+] Validation Accuracy : {acc * 100:.2f}%")
    
    # Feature Importances
    features = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']
    importances = clf.feature_importances_
    print("\n[+] Feature Importance Scores:")
    for f, imp in sorted(zip(features, importances), key=lambda x: x[1], reverse=True):
        print(f"    - {f:12s}: {imp * 100:.1f}%")

if __name__ == '__main__':
    train_model()
