import os
import re

def fix_science_text(text):
    # 1. Convert molecular numbers to subscripts (e.g., Na2ZnO2 -> Na<sub>2</sub>ZnO<sub>2</sub>)
    text = re.sub(r'([A-Z][a-z]*)(\d+)', r'\1<sub>\2</sub>', text)
    text = re.sub(r'(\))(\d+)', r'\1<sub>\2</sub>', text)
    
    # 2. Convert common ion symbols to superscripts
    text = re.sub(r'\b(H|OH|Cl|Na|K|Ag)\+', r'\1<sup>+</sup>', text)
    text = re.sub(r'\b(H|OH|Cl|Na|K|Ag)\-', r'\1<sup>-</sup>', text)
    text = re.sub(r'\b(Ca|Mg|Zn|Cu|SO4|CO3)2\+', r'\1<sup>2+</sup>', text)
    text = re.sub(r'\b(Ca|Mg|Zn|Cu|SO4|CO3)2\-', r'\1<sup>2-</sup>', text)
    
    # 3. Clean up water of crystallization periods into chemical dots (·)
    text = text.replace('.10H<sub>2</sub>O', '·10H<sub>2</sub>O')
    text = text.replace('.5H<sub>2</sub>O', '·5H<sub>2</sub>O')
    text = text.replace('.2H<sub>2</sub>O', '·2H<sub>2</sub>O')
    text = text.replace('.1/2H<sub>2</sub>O', '·&frac12;H<sub>2</sub>O')
    
    # 4. FIX ARROWS: Convert raw text reaction arrows to clean HTML entities (-> to &rarr;)
    text = re.sub(r'(-->|->)', '&rarr;', text)
    text = re.sub(r'(=>)', '&rArr;', text)
    
    return text

def process_html_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split by HTML tags to isolate plain text nodes safely
    tokens = re.split(r'(<[^>]+>)', content)
    
    for i in range(len(tokens)):
        if not tokens[i].startswith('<'):
            tokens[i] = fix_science_text(tokens[i])
            
    updated_content = "".join(tokens)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(updated_content)

def walk_and_fix(target_directory):
    print("Processing flagged HTML files recursively...")
    count = 0
    for root, dirs, files in os.walk(target_directory):
        for file in files:
            if file.endswith('.html'):
                full_path = os.path.join(root, file)
                process_html_file(full_path)
                count += 1
    print(f"Success! Cleaned up and updated formatting in {count} files.")

target_folder = "/home/opc/projects/github/build-caliber/science"
walk_and_fix(target_folder)
