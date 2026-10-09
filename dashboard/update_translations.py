import re

mr_path = 'src/i18n/mr.js'
en_path = 'src/i18n/en.js'

extra_mr = """
  // New Additions
  'Land Holdings Overview': 'जमीन नोंदणी विहंगावलोकन',
  'Current Temperature': 'सध्याचे तापमान',
  'Hyper-Local Climate Intelligence': 'अति-स्थानिक हवामान माहिती',
  'Microclimate & Crops': 'सूक्ष्म हवामान आणि पिके',
  '↻ Refresh Data': '↻ डेटा रिफ्रेश करा',
  'Live Conditions': 'थेट परिस्थिती',
  'Calamity Assessment': 'आपत्ती मूल्यांकन',
  'Normal Conditions': 'सामान्य परिस्थिती',
  'Current weather parameters are within safe operational limits. No immediate threat to registered parcels.': 'सध्याचे हवामान सुरक्षित आहे. नोंदणीकृत भूखंडांना कोणताही तात्काळ धोका नाही.',
  'Initiate Claim Process': 'दावा प्रक्रिया सुरू करा',
  'Crop Risk Assessment': 'पीक धोका मूल्यांकन',
  'Insured Parcels': 'विमाकृत क्षेत्र',
  'No registered crops found.': 'कोणतेही नोंदणीकृत पीक आढळले नाही.',
  '7-Day Trajectory Overview': '७-दिवसीय हवामान कल',
  'Max Temp': 'कमाल तापमान',
  'Min Temp': 'किमान तापमान',
  'Disaster Thresholds': 'आपत्ती मर्यादा',
  'Drought Stress Level': 'दुष्काळ ताण पातळी',
  'Flood Accumulation': 'पूर संचय',
  'Safe': 'सुरक्षित',
  'Policy Trigger Assessment': 'पॉलिसी ट्रिगर मूल्यांकन',
  'Weather events remain below insurance claim thresholds. Continuing routine field monitoring.': 'हवामान घटना विमा दाव्याच्या मर्यादेखाली आहेत. नेहमीची तपासणी सुरू आहे.',
  'Protect Your Livelihood': 'तुमच्या उपजीविकेचे रक्षण करा',
  'Insurance Claims': 'विमा दावे',
  'File and track crop damage insurance claims': 'पीक नुकसानीचे विमा दावे दाखल करा आणि मागोवा घ्या',
  'Cancel': 'रद्द करा',
  'Claim Review Panel': 'दावा आढावा पॅनेल',
  'Review and verify farmer insurance claims with satellite data': 'उपग्रह डेटासह शेतकरी विमा दाव्यांचे पुनरावलोकन आणि पडताळणी करा',
"""

extra_en = """
  // New Additions
  'Land Holdings Overview': 'Land Holdings Overview',
  'Current Temperature': 'Current Temperature',
  'Hyper-Local Climate Intelligence': 'Hyper-Local Climate Intelligence',
  'Microclimate & Crops': 'Microclimate & Crops',
  '↻ Refresh Data': '↻ Refresh Data',
  'Live Conditions': 'Live Conditions',
  'Calamity Assessment': 'Calamity Assessment',
  'Normal Conditions': 'Normal Conditions',
  'Current weather parameters are within safe operational limits. No immediate threat to registered parcels.': 'Current weather parameters are within safe operational limits. No immediate threat to registered parcels.',
  'Initiate Claim Process': 'Initiate Claim Process',
  'Crop Risk Assessment': 'Crop Risk Assessment',
  'Insured Parcels': 'Insured Parcels',
  'No registered crops found.': 'No registered crops found.',
  '7-Day Trajectory Overview': '7-Day Trajectory Overview',
  'Max Temp': 'Max Temp',
  'Min Temp': 'Min Temp',
  'Disaster Thresholds': 'Disaster Thresholds',
  'Drought Stress Level': 'Drought Stress Level',
  'Flood Accumulation': 'Flood Accumulation',
  'Safe': 'Safe',
  'Policy Trigger Assessment': 'Policy Trigger Assessment',
  'Weather events remain below insurance claim thresholds. Continuing routine field monitoring.': 'Weather events remain below insurance claim thresholds. Continuing routine field monitoring.',
  'Protect Your Livelihood': 'Protect Your Livelihood',
  'Insurance Claims': 'Insurance Claims',
  'File and track crop damage insurance claims': 'File and track crop damage insurance claims',
  'Cancel': 'Cancel',
  'Claim Review Panel': 'Claim Review Panel',
  'Review and verify farmer insurance claims with satellite data': 'Review and verify farmer insurance claims with satellite data',
"""

def inject(path, extra):
    with open(path, 'r') as f:
        content = f.read()
    
    # Insert right before the last closing brace
    idx = content.rfind('};')
    if idx != -1:
        new_content = content[:idx] + extra + content[idx:]
        with open(path, 'w') as f:
            f.write(new_content)

inject(mr_path, extra_mr)
inject(en_path, extra_en)
