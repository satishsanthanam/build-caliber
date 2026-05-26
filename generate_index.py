#!/usr/bin/env python3
import os
import re
import html

TARGET_DIR = "."
OUTPUT_FILE = "index.html"
EXCLUDE_DIRS = {'.git', '.github', 'node_modules', 'factory-builds'}
EXCLUDE_FILES = {'index.html', 'style.css', 'completed.txt', 'server.log', 'generate_index.py', 'rename_existing.py'}

def parse_class_display(folder_name):
    """
    Parses folder names to support multi-part volumes.
    e.g., "class-8-1" -> "Class 8 (Part 1)"
          "class-9"   -> "Class 9"
    """
    # Check for multi-part tracking signatures (class-X-Y)
    part_match = re.match(r'^class-(\d+)-(\d+)$', folder_name, re.IGNORECASE)
    if part_match:
        return f"Class {part_match.group(1)} (Part {part_match.group(2)})"
        
    # Standard fallback tracking (class-X)
    single_match = re.match(r'^class-(\d+)$', folder_name, re.IGNORECASE)
    if single_match:
        return f"Class {single_match.group(1)}"
        
    return folder_name.replace('-', ' ').title()

def build_curriculum_tree():
    tree = {}
    # Natively maps: mm-chapter-nn-topic.html
    pattern = re.compile(r'^(\d{2})-chapter-(\d{2})-(.+)\.html$')
    
    for root, dirs, files in os.walk(TARGET_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        rel_path = os.path.relpath(root, TARGET_DIR)
        if rel_path == ".":
            continue
            
        path_parts = rel_path.split(os.sep)
        if len(path_parts) >= 2:
            subject_display = path_parts[0].replace('-', ' ').title()
            raw_class_folder = path_parts[1]
            
            # Compute structural parent menus using folder metrics
            class_display = parse_class_display(raw_class_folder)
            
            for file in files:
                match = pattern.match(file)
                if match and file not in EXCLUDE_FILES:
                    _, nn_str, topic_slug = match.groups()
                    
                    chapter_num = int(nn_str)
                    title_display = topic_slug.replace('-', ' ').title()
                    web_url_path = os.path.join(rel_path, file).replace(os.sep, '/')
                    
                    if subject_display not in tree:
                        tree[subject_display] = {}
                    if class_display not in tree[subject_display]:
                        tree[subject_display][class_display] = []
                        
                    tree[subject_display][class_display].append({
                        "num": chapter_num,
                        "title": title_display,
                        "url": web_url_path
                    })
    return tree

def generate_html_file(tree):
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
    details > summary { list-style: none !important; outline: none !important; position: relative !important; padding: 6px 10px 6px 45px !important; display: block !important; cursor: pointer; box-sizing: border-box;}
    details > summary::-webkit-details-marker { display: none !important; }
    details > summary::marker { display: none !important; content: ""; }
    details > summary:hover { color: #0056b3; }
    details > summary::before { content: '[+]'; position: absolute !important; left: 12px !important; top: 50% !important; transform: translateY(-50%) !important; font-weight: bold !important; color: #0056b3 !important; font-size: 1em !important; font-family: monospace !important;}
    details[open] > summary::before { content: '[-]'; color: #e67e22 !important; }
  </style>
</head>
<body>
  <div class="nav-bar" style="margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 10px;">
    <h2>Build Calibre Curriculum Database</h2>
  </div>\n"""

    for subject in sorted(tree.keys()):
        html_out += f'  <div class="topic-box">\n    <details>\n      <summary class="topic-title">Subject: {html.escape(subject)}</summary>\n'
        
        # Natural alpha-numeric sorting sequence layout (Class 8 Part 1 -> Class 8 Part 2 -> Class 9)
        sorted_classes = sorted(tree[subject].keys(), key=lambda x: [int(s) if s.isdigit() else s for s in re.split(r'(\d+)', x)])
        for class_level in sorted_classes:
            html_out += f'      <div class="sub-topic" style="margin-left: 20px;">\n        <details>\n          <summary class="class-title">{html.escape(class_level)}</summary>\n          <ul class="clean-list">\n'
            
            # Sort individual chapters numerically
            tree[subject][class_level].sort(key=lambda x: x['num'])
            for chap in tree[subject][class_level]:
                html_out += f'            <li class="chapter-row"><span class="keyword"><a href="{html.escape(chap["url"])}"><strong>Chapter {chap["num"]}:</strong> {html.escape(chap["title"])}</a></span></li>\n'
                
            html_out += "          </ul>\n        </details>\n      </div>\n"
        html_out += "    </details>\n  </div>\n"

    html_out += "</body>\n</html>"
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(html_out)

if __name__ == "__main__":
    print("📂 Scanning filesystem reality for multi-book assets...")
    data_tree = build_curriculum_tree()
    generate_html_file(data_tree)
    print(f"🚀 SUCCESS: Local split volume index '{OUTPUT_FILE}' compiled perfectly.")
