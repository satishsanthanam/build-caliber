#!/usr/bin/env python3
import os
import re
import html

# ⚙️ Configuration
TARGET_DIR = "."
OUTPUT_FILE = "index.html"

# Ignore patterns to prevent system noise or configuration loops
EXCLUDE_DIRS = {'.git', '.github', 'node_modules', 'factory-builds'}
EXCLUDE_FILES = {'index.html', 'style.css', 'completed.txt', 'server.log', 'generate_index.py'}

def clean_filename_to_title(filename):
    """
    Converts a filename slug (e.g., 'chemical-reactions-and-equations.html') 
    directly into a human-readable title with proper capitalization.
    Handles optional leading chapter numbers if present (e.g., '01-real-numbers.html').
    """
    # Strip extension
    base_name = os.path.splitext(filename)[0]
    
    # Check if filename starts with a number pattern (e.g., "01-", "1_", "chapter-2-")
    num_match = re.match(r'^(?:chapter[-_])?(\d+)[-_]+(.*)$', base_name, re.IGNORECASE)
    
    if num_match:
        chap_num = int(num_match.group(1))
        rest_of_name = num_match.group(2)
        # Reconstruct clean title string
        clean_title = rest_of_name.replace('-', ' ').replace('_', ' ').strip().title()
        return chap_num, clean_title
    else:
        # No explicit chapter number found in filename prefix
        clean_title = base_name.replace('-', ' ').replace('_', ' ').strip().title()
        return None, clean_title

def natural_sort_key(string):
    """Guarantees Class 6 reads before Class 10 by breaking numbers out of text."""
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', string)]

def build_curriculum_tree():
    """Traverses local Unix directory tree to group paths natively by subject and class."""
    tree = {}
    
    for root, dirs, files in os.walk(TARGET_DIR):
        # Prune excluded directories inline
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        # Calculate depth relative to target run directory
        rel_path = os.path.relpath(root, TARGET_DIR)
        if rel_path == ".":
            continue
            
        path_parts = rel_path.split(os.sep)
        
        # We look strictly for the depth: [subject]/[class_level]
        if len(path_parts) >= 2:
            raw_subject = path_parts[0]
            raw_class = path_parts[1]
            
            # Format display folders cleanly (e.g., "mathematics" -> "Mathematics")
            subject_display = raw_subject.replace('-', ' ').replace('_', ' ').title()
            class_display = raw_class.replace('-', ' ').replace('_', ' ').title()
            
            for file in files:
                if file.endswith('.html') and file not in EXCLUDE_FILES:
                    web_url_path = os.path.join(rel_path, file).replace(os.sep, '/')
                    chap_num, title_display = clean_filename_to_title(file)
                    
                    if subject_display not in tree:
                        tree[subject_display] = {}
                    if class_display not in tree[subject_display]:
                        tree[subject_display][class_display] = []
                        
                    tree[subject_display][class_display].append({
                        "num": chap_num,
                        "title": title_display,
                        "url": web_url_path,
                        "filename": file
                    })
    return tree

def generate_html_file(tree):
    """Compiles the tree structure using the exact CSS styles provided."""
    html_out = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="style.css">
  <title>Build Calibre - Curriculum Home</title>
  <style>
    body { font-family: sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;}
    .clean-list { list-style-type: none; padding-left: 10px; border-left: 2px solid #eee; margin-left: 10px; margin-bottom: 10px; }
    .keyword a { color: #0056b3; text-decoration: none; font-size: 1.05em; }
    .keyword a:hover { text-decoration: underline; color: #003d82; }
    .chapter-row { margin-bottom: 12px; }
    .topic-box { margin-bottom: 15px; border: 1px solid #ddd; padding: 15px; border-radius: 8px; background-color: #fafafa; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    
    .topic-title { font-size: 1.3em; font-weight: bold; color: #2c3e50; }
    .class-title { font-size: 1.1em; font-weight: 600; color: #34495e; margin-top: 10px; }
    
    details > summary { 
      list-style: none !important; 
      outline: none !important; 
      position: relative !important; 
      padding: 6px 10px 6px 45px !important;
      display: block !important;             
      cursor: pointer;
      box-sizing: border-box;
    }
    details > summary::-webkit-details-marker { display: none !important; }
    details > summary::marker { display: none !important; content: ""; }
    details > summary:hover { color: #0056b3; }
    
    details > summary::before { 
      content: '[+]'; 
      position: absolute !important; 
      left: 12px !important; 
      top: 50% !important;
      transform: translateY(-50%) !important;
      font-weight: bold !important; 
      color: #0056b3 !important; 
      font-size: 1em !important; 
      font-family: monospace !important;
    }
    details[open] > summary::before { 
      content: '[-]'; 
      color: #e67e22 !important; 
    }
  </style>
</head>
<body>
  <div class="nav-bar" style="margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 10px;">
    <h2>Build Calibre Curriculum Database</h2>
  </div>\n"""

    # 1. Sort Subjects Alphabetically
    for subject in sorted(tree.keys()):
        html_out += f'  <div class="topic-box">\n    <details>\n      <summary class="topic-title">Subject: {html.escape(subject)}</summary>\n'
        
        # 2. Sort Classes Naturally (Class 6 before Class 10)
        sorted_classes = sorted(tree[subject].keys(), key=natural_sort_key)
        for class_level in sorted_classes:
            html_out += f'      <div class="sub-topic" style="margin-left: 20px;">\n        <details>\n          <summary class="class-title">{html.escape(class_level)}</summary>\n          <ul class="clean-list">\n'
            
            # 3. Sort Chapters (Use chapter number if prefix exists, otherwise sort alphabetically by filename)
            chapters = tree[subject][class_level]
            has_numbers = any(c['num'] is not None for c in chapters)
            
            if has_numbers:
                chapters.sort(key=lambda x: (x['num'] if x['num'] is not None else 999, x['filename']))
            else:
                chapters.sort(key=lambda x: x['filename'])
                
            # Loop and generate standard chapter listing items
            for idx, chap in enumerate(chapters, start=1):
                # If filename had no numbers, dynamically assign its position index as chapter display
                display_num = chap['num'] if chap['num'] is not None else idx
                
                html_out += f'            <li class="chapter-row"><span class="keyword"><a href="{html.escape(chap["url"])}"><strong>Chapter {display_num}:</strong> {html.escape(chap["title"])}</a></span></li>\n'
                
            html_out += "          </ul>\n        </details>\n      </div>\n"
        html_out += "    </details>\n  </div>\n"

    html_content = html_out + "</body>\n</html>"
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(html_content)

if __name__ == "__main__":
    print("📂 Scanning local Unix directory structure...")
    curriculum_data = build_curriculum_tree()
    generate_html_file(curriculum_data)
    print(f"✅ SUCCESS: {OUTPUT_FILE} has been rebuilt using file paths.")
