import re

files = [
    '/Users/tanmaykadam/Desktop/dex/CS/Hackathon/SkyCrop-main/dashboard/src/pages/Home.jsx',
    '/Users/tanmaykadam/Desktop/dex/CS/Hackathon/SkyCrop-main/dashboard/src/pages/Weather.jsx'
]

replacements = {
    "'#111'": "theme.text",
    "'#111111'": "theme.text",
    "'#fff'": "theme.bg",
    "'#FFFFFF'": "theme.bg",
    "'rgba(0,0,0,0.1)'": "theme.border",
    "'rgba(0,0,0,0.2)'": "theme.border",
    "'rgba(0,0,0,0.05)'": "theme.border",
    "'#000'": "theme.text",
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
        print(f"Updated {filepath}")
