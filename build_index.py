import os
import re

def generate_index():
    print("🔍 Scanning repository for HTML chapters...")
    
    # Dictionary to hold our nested curriculum structure
    # Format: { "Science": { "Class 10": [ ("1", "Electricity", "science/class-10/electricity.html") ] } }
    curriculum_map = {}
    
    # Walk through the local directories (assuming structure like: science/class-10/chapter.html)
    for root, dirs, files in os.walk("."):
        # Ignore hidden folders like .git
        if "/." in root or root.startswith("./."):
            continue
            
        for file in files:
            if file.endswith(".html") and file != "index.html" and file != "Prompt.html":
                # Clean up the path
                path = os.path.join(root, file).replace("./", "")
                parts = path.split("/")
                
                # Ensure it matches expected depth (subject/class/file.html)
                if len(parts) >= 3:
                    subject_raw = parts[0]
                    class_raw = parts[1]
                    file_raw = parts[2].replace(".html", "")
                    
                    # Format strings nicely (e.g., "science" -> "Science", "class-10" -> "Class 10")
                    subject = subject_raw.replace("-", " ").title()
                    class_level = class_raw.replace("-", " ").title()
                    
                    # Clean up the title 
                    title = file_raw.replace("-", " ").title()
                    
                    # Since we are scanning locally and don't have the Sheet's chapter numbers, 
                    # we will just use a bullet point or sequential counter for the local build.
                    if subject not in curriculum_map:
                        curriculum_map[subject] = {}
                    if class_level not in curriculum_map[subject]:
                        curriculum_map[subject][class_level] = []
                        
                    curriculum_map[subject][class_level].append({
                        "title": title,
                        "path": path
                    })

    # Count total found
    completed_count = sum(len(chapters) for sub in curriculum_map.values() for chapters in sub.values())
    
    if completed_count == 0:
        print("⚠️ No HTML chapters found. Index generation halted.")
        return

    print(f"✅ Found {completed_count} chapters. Building HTML...")

    # 🌟 THE FIX: Notice the double curly braces {{ }} in the <style> block
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="style.css">
  <title>Study Alchemist - Curriculum Home</title>
  <style>
    /* CSS Braces are doubled so Python f-strings ignore them */
    .clean-list {{ list-style-type: none; padding-left: 0; }}
    .keyword a {{ color: inherit; text-decoration: none; font-weight: 500; }}
    .keyword a:hover {{ text-decoration: underline; color: #0056b3; }}
    .chapter-row {{ margin-bottom: 8px; }}
    .topic-box {{ margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 8px; }}
    .topic-title {{ font-size: 1.2em; font-weight: bold; margin-bottom: 10px; }}
  </style>
</head>
<body>
  <div class="nav-bar">
    <h2>🔮 Study Alchemist Curriculum Database</h2>
  </div>
"""

    # Loop through the map and build the HTML sections dynamically
    for subject, classes in sorted(curriculum_map.items()):
        html += f'  <div class="topic-box">\n    <div class="topic-title">📚 Subject: {subject}</div>\n'
        
        for class_level, chapters in sorted(classes.items()):
            html += f'    <div class="sub-topic">\n      <h3>{class_level}</h3>\n      <ul class="clean-list">\n'
            
            # Sort chapters alphabetically locally
            chapters = sorted(chapters, key=lambda k: k['title'])
            
            # Print numbered list based on local loop index
            for idx, chapter in enumerate(chapters, start=1):
                html += f'        <li class="chapter-row"><span class="keyword"><a href="{chapter["path"]}">{idx}. {chapter["title"]}</a></span></li>\n'
            
            html += f'      </ul>\n    </div>\n'
        html += f'  </div>\n'

    html += f"</body>\n</html>"

    # Write the completed HTML file locally
    with open("index.html", "w", encoding="utf-8") as f:
        f.write(html)

    print("🚀 SUCCESS: index.html generated perfectly!")

if __name__ == "__main__":
    generate_index()
