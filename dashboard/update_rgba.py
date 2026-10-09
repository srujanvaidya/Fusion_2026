import re

files = [
    '/Users/tanmaykadam/Desktop/dex/CS/Hackathon/SkyCrop-main/dashboard/src/pages/InsuranceClaims.jsx',
    '/Users/tanmaykadam/Desktop/dex/CS/Hackathon/SkyCrop-main/dashboard/src/pages/Home.jsx',
    '/Users/tanmaykadam/Desktop/dex/CS/Hackathon/SkyCrop-main/dashboard/src/pages/MyLand.jsx',
    '/Users/tanmaykadam/Desktop/dex/CS/Hackathon/SkyCrop-main/dashboard/src/components/GeoTagPhoto.jsx'
]

replacements = {
    "'rgba(0,0,0,0.1)'": "theme.border",
    "`1px solid rgba(0,0,0,0.1)`": "`1px solid ${theme.border}`",
    "`1px solid rgba(0,0,0,0.2)`": "`1px solid ${theme.border}`",
    "`1px dashed rgba(0,0,0,0.2)`": "`1px dashed ${theme.border}`",
    "'rgba(0,0,0,0.2)'": "theme.border",
    "'rgba(0,0,0,0.05)'": "theme.border",
    "`1px solid rgba(0,0,0,0.05)`": "`1px solid ${theme.border}`"
}

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated rgba in {filepath}")
