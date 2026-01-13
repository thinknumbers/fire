
import os
import re

file_path = "g:/My Drive/Think Numbers/FIRE Wealth/src/RiskReturnOptimiser.jsx"
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace any escaped quotes in JSX props like type=\"number\"
# We look for backslash followed by double quote
new_content = content.replace('\\"', '"')

# Replace NBSPs with regular spaces
new_content = new_content.replace('\u00a0', ' ')

if content != new_content:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Replacements made.")
else:
    print("No changes needed.")
