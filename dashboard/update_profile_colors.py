import re

filepath = '/Users/tanmaykadam/Desktop/dex/CS/Hackathon/SkyCrop-main/dashboard/src/pages/Profile.jsx'
with open(filepath, 'r') as f:
    content = f.read()

replacements = {
    "'#111'": "theme.text",
    "'#fff'": "theme.bg",
    "background: theme.text, color: theme.bg": "background: theme.text, color: theme.bg", # self-correction
}

for old, new in replacements.items():
    content = content.replace(old, new)

# For lines 131 and 274 where color '#111' is on an accent background, it should remain dark.
# Let's revert those explicitly using regex
content = re.sub(r'(background: theme\.accent,.*?color:\s*)theme\.text', r'\1"#111"', content)

with open(filepath, 'w') as f:
    f.write(content)
print("Updated Profile.jsx")
