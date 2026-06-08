#!/usr/bin/env python3
import os
import re
import html
import subprocess

TARGET_DIR = "."
OUTPUT_FILE = "index.html"

# FIXED: Added 'pagefind' here to prevent the script from treating search index folders as subjects
EXCLUDE_DIRS = {'.git', '.github', 'node_modules', 'factory-builds', 'pagefind'}
EXCLUDE_FILES = {'index.html', 'style.css', 'completed.txt', 'server.log', 'generate_index.py', 'rename_existing.py'}

def rebuild_search_index():
    print("\n🚀 All HTML files generated. Rebuilding Pagefind search index...")
    
    # Dynamically gets the absolute folder path where THIS script is running
    current_script_dir = os.path.dirname(os.path.abspath(__file__))
    
    command = [
        "python3", "-m", "pagefind", 
        "--site", current_script_dir
    ]
    
    # Execute it directly inside the instance environment
    result = subprocess.run(command, capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✅ Search index updated flawlessly!")
    else:
        print("❌ Pagefind indexing failed:")
        print(result.stderr)

def parse_class_display(folder_name):
    """
    Parses folder names to support multi-part volumes.
    e.g., "class-8-1" -> "Class 8 (Part 1)"
          "class-9"   -> "Class 9"
    """
    part_match = re.match(r'^class-(\d+)-(\d+)$', folder_name, re.IGNORECASE)
    if part_match:
        return f"Class {part_match.group(1)} (Part {part_match.group(2)})"
        
    single_match = re.match(r'^class-(\d+)$', folder_name, re.IGNORECASE)
    if single_match:
        return f"Class {single_match.group(1)}"
        
    return folder_name.replace('-', ' ').title()

def build_curriculum_tree():
    tree = {}
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
            class_display = parse_class_display(raw_class_folder)
            
            if subject_display not in tree:
                tree[subject_display] = {}
            if class_display not in tree[subject_display]:
                tree[subject_display][class_display] = []
            
            for file in files:
                match = pattern.match(file)
                if match and file not in EXCLUDE_FILES:
                    _, nn_str, topic_slug = match.groups()
                    
                    chapter_num = int(nn_str)
                    title_display = topic_slug.replace('-', ' ').title()
                    
                    if len(topic_slug) >= 28 or any(title_display.endswith(w) for w in [" Of Coor", " Introduct", " Healthy", " Explori", " Va", " Their Sur"]):
                        title_display += "..."

                    web_url_path = os.path.join(rel_path, file).replace(os.sep, '/')

                    is_duplicate = any(item['num'] == chapter_num for item in tree[subject_display][class_display])
                    final_title = f"{title_display} (Alternate Version)" if is_duplicate else title_display

                    tree[subject_display][class_display].append({
                        "num": chapter_num,
                        "title": final_title,
                        "url": web_url_path
                    })
    return tree

def generate_html_file(tree):
    # FIXED: Restored your clean, modern inline flex nav-bar structure with the right-aligned search box
    html_out = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <link rel="stylesheet" href="style.css">
  <title>Build Calibre: NCERT Curriculum Short Notes</title>
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
  <div class="nav-bar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 15px;">
      <h2 style="margin: 0; font-size: 26px; color: #333; font-weight: 700;">Build Calibre: NCERT Curriculum Short Notes</h2>
      <a href="./search.html" style="display: flex; align-items: center; gap: 6px; color: #007bff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 8px 16px; border-radius: 6px; background-color: rgba(0,123,255,0.06); border: 1px solid rgba(0,123,255,0.12); transition: background 0.2s;">
          <span>🔍</span> Search
      </a>
  </div>\n"""

    for subject in sorted(tree.keys()):
        html_out += f'  <div class="topic-box">\n    <details>\n      <summary class="topic-title">Subject: {html.escape(subject)}</summary>\n'
        
        sorted_classes = sorted(tree[subject].keys(), key=lambda x: [int(s) if s.isdigit() else s for s in re.split(r'(\d+)', x)])
        for class_level in sorted_classes:
            html_out += f'      <div class="sub-topic" style="margin-left: 20px;">\n        <details>\n          <summary class="class-title">{html.escape(class_level)}</summary>\n          <ul class="clean-list">\n'
            
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

    # Trigger Pagefind search engine index automation
    rebuild_search_index()
