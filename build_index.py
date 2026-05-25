import os
from collections import defaultdict

def format_title(filename):
    """Converts 'force-and-laws-of-motion.html' to 'Force And Laws Of Motion'"""
    name = filename.replace('.html', '')
    return name.replace('-', ' ').title()

def format_directory_name(dirname):
    """Converts 'class-9' to 'Class 9'"""
    return dirname.replace('-', ' ').title()

def generate_index():
    repo_root = '.'
    curriculum = defaultdict(lambda: defaultdict(list))
    
    print("🔍 Scanning local repository for HTML chapters...")

    # 1. Walk the directory tree
    for root, dirs, files in os.walk(repo_root):
        # Ignore hidden git folders
        if '.git' in root:
            continue

        for file in files:
            # Only process HTML files, ignore the root index and template files
            if file.endswith('.html') and file not in ['index.html', 'Prompt.html']:
                # Get the relative path (e.g., science/class-9/motion.html)
                rel_path = os.path.relpath(os.path.join(root, file), repo_root)
                parts = rel_path.split(os.sep)
                
                # Ensure it matches our expected Subject/Class/Chapter structure
                if len(parts) >= 3:
                    subject = format_directory_name(parts[0])
                    class_level = format_directory_name(parts[1])
                    title = format_title(file)
                    # Force forward slashes for web URLs (crucial if running on Windows!)
                    web_path = rel_path.replace(os.sep, '/')
                    
                    curriculum[subject][class_level].append({
                        'title': title,
                        'path': web_path
                    })

    if not curriculum:
        print("⚠️ No chapters found in subdirectories!")
        return

    # 2. Build the HTML string
    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="style.css">
  <title>Study Alchemist - Curriculum Home</title>
  <style>
    .keyword a { color: inherit; text-decoration: none; }
    .keyword a:hover { text-decoration: underline; }
    /* Ensures summary markers behave nicely with topic titles */
    summary { cursor: pointer; outline: none; }
  </style>
</head>
<body>
  <div class="nav-bar">
    <h2>🔮 Study Alchemist Curriculum Database</h2>
  </div>\n"""

    # 3. Construct the Nestable Collapsible Accordion Hierarchy
    for subject in sorted(curriculum.keys()):
        html += f'  <details class="topic-box">\n    <summary class="topic-title">📚 Subject: {subject}</summary>\n'
        
        for class_level in sorted(curriculum[subject].keys()):
            # 🌟 FIXED: Added inline display behavior to keep the arrow and heading text on the same line
            html += f'    <details class="sub-topic" style="margin-bottom: 10px;">\n      <summary><h3 style="display: inline; margin: 0; padding-left: 5px;">{class_level}</h3></summary>\n      <ul>\n'
            
            # Sort chapters alphabetically
            sorted_chapters = sorted(curriculum[subject][class_level], key=lambda x: x['title'])
            for chapter in sorted_chapters:
                html += f'        <li><span class="keyword"><a href="{chapter["path"]}">{chapter["title"]}</a></span></li>\n'
                
            html += '      </ul>\n    </details>\n'
        html += '  </details>\n'

    html += "</body>\n</html>"

    # 4. Write to the index.html file
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
        
    print("✅ SUCCESS: Fully collapsed index.html generated beautifully!")

if __name__ == "__main__":
    generate_index()
