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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>Build Calibre - Curriculum Home</title>
  <style>
    /* 🛠️ GLOBAL MOBILE CORE RESET */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      line-height: 1.6; 
      color: #2d3748; 
      background-color: #f7fafc;
      padding: 16px;
    }
    .index-wrapper {
      width: 100%;
      max-width: 768px; /* Fluid scaling bounds for text blocks */
      margin: 0 auto;
    }
    @media (min-width: 600px) {
      body { padding: 32px; }
    }
    .clean-list { 
      list-style-type: none; 
      padding-left: 0; 
      margin-top: 8px;
    }
    .chapter-row { 
      margin-bottom: 10px; 
    }
    /* 🎯 ACCESSIBLE INTERACTIVE TOUCH TARGETS FOR CHAPTER LINKS */
    .keyword a { 
      display: flex;
      align-items: center;
      min-height: 44px; /* Standard fingertip boundary size to prevent misclicks */
      padding: 10px 14px;
      color: #2b6cb0; 
      text-decoration: none; 
      background-color: #ffffff;
      border: 1px solid #edf2f7;
      border-radius: 6px;
      font-size: 15px; 
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
      transition: all 0.2s ease;
      word-wrap: break-word;
      word-break: break-word;
    }
    .keyword a:hover {
      background-color: #ebf8ff;
      border-color: #bee3f8;
    }
    .keyword a:active { 
      background-color: #ebf8ff; 
      transform: scale(0.99); 
    }
    .topic-box { 
      margin-bottom: 16px; 
      border: 1px solid #e2e8f0; 
      border-radius: 10px; 
      background-color: #ffffff; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.02); 
      overflow: hidden;
    }
    .sub-topic {
      margin: 10px 12px;
    }
    /* 🧱 SOLID UNIFORM ACCORDION CLICK TARGETS */
    details > summary { 
      display: flex !important;
      align-items: center !important;
      min-height: 48px;
      padding: 12px 16px 12px 40px !important; 
      cursor: pointer; 
      user-select: none;
      outline: none !important;
      position: relative !important;
      box-sizing: border-box;
    }
    details > summary::-webkit-details-marker { display: none !important; }
    details > summary::marker { display: none !important; content: ""; }
    
    .topic-title { font-size: 1.25em; font-weight: bold; color: #2b6cb0; background-color: #ebf8ff; }
    .class-title { font-size: 1.05em; font-weight: 600; color: #4a5568; background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 6px; }
    
    /* 📐 PLUMB-LINE VERTICAL ACCORDION INDICATORS */
    details > summary::before { 
      content: "▶"; 
      position: absolute !important; 
      left: 16px !important; 
      top: 50% !important; 
      transform: translateY(-50%) translateY(1px) !important; /* Micro-translated 1px downward to center font glyph */
      font-size: 10px !important;
      transition: transform 0.2s ease;
      color: #4a5568;
    }
    .topic-title::before { color: #3182ce !important; }
    details[open] > summary::before { transform: translateY(-50%) rotate(90deg) !important; color: #e67e22 !important; }
    
    .inner-content {
      padding: 12px 16px;
    }
  </style>
</head>
<body>
  <div class="index-wrapper">
    <div class="nav-bar" style="margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">
      <h2 style="font-size: 22px; color: #1a202c;">Build Calibre Curriculum Database</h2>
    </div>\n"""

    for subject in sorted(tree.keys()):
        html_out += f'  <div class="topic-box">\n    <details>\n      <summary class="topic-title">Subject: {html.escape(subject)}</summary>\n      <div class="inner-content">\n'
        
        # Natural alpha-numeric sorting sequence layout (Class 8 Part 1 -> Class 8 Part 2 -> Class 9)
        sorted_classes = sorted(tree[subject].keys(), key=lambda x: [int(s) if s.isdigit() else s for s in re.split(r'(\d+)', x)])
        for class_level in sorted_classes:
            html_out += f'        <div class="sub-topic">\n          <details>\n            <summary class="class-title">{html.escape(class_level)}</summary>\n            <div class="inner-content">\n              <ul class="clean-list">\n'
            
            # Sort individual chapters numerically
            tree[subject][class_level].sort(key=lambda x: x['num'])
            for chap in tree[subject][class_level]:
                html_out += f'                <li class="chapter-row"><span class="keyword"><a href="{html.escape(chap["url"])}"><strong>Chapter {chap["num"]}:</strong> {html.escape(chap["title"])}</a></span></li>\n'
                
            html_out += "              </ul>\n            </div>\n          </details>\n        </div>\n"
        html_out += "      </div>\n    </details>\n  </div>\n"

    html_out += "  </div>\n</body>\n</html>"
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(html_out)

if __name__ == "__main__":
    print("📂 Scanning filesystem reality for multi-book assets...")
    data_tree = build_curriculum_tree()
    generate_html_file(data_tree)
    print(f"🚀 SUCCESS: Local split volume index '{OUTPUT_FILE}' compiled perfectly.")
