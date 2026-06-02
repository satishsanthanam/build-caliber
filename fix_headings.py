#!/usr/bin/env python3
import os
import re

TARGET_DIR = "."
EXCLUDE_DIRS = {'.git', '.github', 'node_modules', 'factory-builds', 'pagefind'}

def parse_class_display(folder_name):
    """Parses folder tags to match your standard class formatting."""
    part_match = re.match(r'^class-(\d+)-(\d+)$', folder_name, re.IGNORECASE)
    if part_match:
        return f"Class {part_match.group(1)} (Part {part_match.group(2)})"
    single_match = re.match(r'^class-(\d+)$', folder_name, re.IGNORECASE)
    if single_match:
        return f"Class {single_match.group(1)}"
    return folder_name.replace('-', ' ').title()

def update_chapter_headings():
    file_pattern = re.compile(r'^(\d{2})-chapter-(\d{2})-(.+)\.html$')
    # Target <h1>Chapter X: or <h2>Chapter X: blocks
    heading_pattern = re.compile(r'(<h[12][^>]*>)\s*(Chapter\s+\d+:)', re.IGNORECASE)
    
    updated_count = 0

    print("🔍 Scanning chapter summaries for header updates...")

    for root, dirs, files in os.walk(TARGET_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        rel_path = os.path.relpath(root, TARGET_DIR)
        if rel_path == ".":
            continue
        
        path_parts = rel_path.split(os.sep)
        if len(path_parts) >= 2:
            raw_class_folder = path_parts[1]
            class_display = parse_class_display(raw_class_folder)
            
            for file in files:
                if file_pattern.match(file):
                    file_path = os.path.join(root, file)
                    
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # Safety check: Avoid duplicate execution if Class is already there
                    if re.search(r'<h[12][^>]*>\s*Class\s+\d+', content, re.IGNORECASE):
                        continue
                        
                    # Prepend class structure to the heading match group
                    new_content, count = heading_pattern.subn(rf'\1{class_display} — \2', content)
                    
                    if count > 0:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        updated_count += 1
                        print(f"✨ Transformed: {file_path} -> Added '{class_display}'")
                        
    print(f"\n✅ Modification complete! Fixed headings across {updated_count} files.")

if __name__ == "__main__":
    update_chapter_headings()
