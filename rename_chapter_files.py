#!/usr/bin/env python3
import os
import re

TARGET_DIR = "."
EXCLUDE_DIRS = {'.git', '.github', 'node_modules', 'factory-builds'}
EXCLUDE_FILES = {'index.html', 'style.css', 'completed.txt', 'server.log', 'generate_index.py', 'rename_existing.py'}

def extract_chapter_from_content(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read(4096)
            match = re.search(r'Chapter\s+(\d+)', content, re.IGNORECASE)
            if match:
                return f"{int(match.group(1)):02d}"
    except Exception:
        pass
    return "00"

def rename_system_assets():
    print("🔄 Initializing absolute filesystem asset renamer...")
    rename_count = 0

    for root, dirs, files in os.walk(TARGET_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        rel_path = os.path.relpath(root, TARGET_DIR)
        if rel_path == ".":
            continue
            
        path_parts = rel_path.split(os.sep)
        if len(path_parts) >= 2:
            raw_class_folder = path_parts[1] # e.g., "class-8-1"
            
            # Extract first numerical sequence to use as the base class number (mm)
            class_num_match = re.search(r'\d+', raw_class_folder)
            if not class_num_match:
                continue
            mm = f"{int(class_num_match.group(0)):02d}" # "class-8-1" successfully extracts "08"
            
            for file in files:
                if file.endswith('.html') and file not in EXCLUDE_FILES:
                    # Avoid infinite loops by skipping files that match the pattern
                    if re.match(r'^\d{2}-chapter-\d{2}-', file):
                        continue
                        
                    full_old_path = os.path.join(root, file)
                    base_name = os.path.splitext(file)[0]
                    
                    # Extract chapter markers (nn)
                    chap_num_match = re.match(r'^(?:chapter[-_])?(\d+)', base_name, re.IGNORECASE)
                    if chap_num_match:
                        nn = f"{int(chap_num_match.group(1)):02d}"
                        raw_topic = base_name[chap_num_match.end():].strip('-_')
                    else:
                        nn = extract_chapter_from_content(full_old_path)
                        raw_topic = base_name
                    
                    # Compute topic slug layout values
                    topic_slug = raw_topic.lower().replace('_', '-').strip('-')
                    topic_slug = re.sub(r'[^a-z0-9\-]', '', topic_slug)
                    
                    # Enforce strict 48-character length limit on the base filename
                    # Prefix prefix layout 'mm-chapter-nn-' is exactly 14 characters
                    # Maximum remaining character limit for the topic slug = 48 - 14 = 34 characters
                    truncated_topic = topic_slug[:34].rstrip('-')
                    
                    new_filename = f"{mm}-chapter-{nn}-{truncated_topic}.html"
                    full_new_path = os.path.join(root, new_filename)
                    
                    print(f"   ↳ Renaming: {file} ➡️ {new_filename}")
                    os.rename(full_old_path, full_new_path)
                    rename_count += 1

    print(f"✅ SUCCESS: {rename_count} assets normalized to standard 48-character format.")

if __name__ == "__main__":
    rename_system_assets()
