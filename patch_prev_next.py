import os
import re

def upgrade_html_file(filepath, filename, directory_files):
    name_match = re.match(r"^(\d+)-chapter-(\d+)-", filename)
    if not name_match:
        return False
    
    class_num = int(name_match.group(1))
    chap_num = int(name_match.group(2))
    next_chap_num = chap_num + 1
    
    # Look ahead in the current directory to find the actual filename of the next chapter
    next_filename = "../../index.html" # Default fallback if it's the last chapter
    padded_class = f"{class_num:02d}"
    padded_next_chap = f"{next_chap_num:02d}"
    next_prefix = f"{padded_class}-chapter-{padded_next_chap}-"
    
    for f_name in directory_files:
        if f_name.startswith(next_prefix) and f_name.endswith(".html"):
            next_filename = f_name
            break

    # Look backward in the python runtime loop
    prev_filename = "../../index.html"
    padded_prev_chap = f"{(chap_num - 1):02d}"
    prev_prefix = f"{padded_class}-chapter-{padded_prev_chap}-"
    
    for f_name in directory_files:
        if f_name.startswith(prev_prefix) and f_name.endswith(".html"):
            prev_filename = f_name
            break

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if "navModal" in content:
        return False
        
    h1_match = re.search(r"<h1>(.*?)</h1>", content, re.IGNORECASE | re.DOTALL)
    if not h1_match:
        return False
        
    raw_h1_text = h1_match.group(1).strip()
    clean_title = re.sub(r"^Chapter\s+\d+[\s:-]*", "", raw_h1_text, flags=re.IGNORECASE).strip()
    #new_master_title = f"Class {class_num} — Chapter {chap_num}: {clean_title}"
    new_master_title = f"{clean_title}"
    
    print(f"⚡ Patching: Ch {chap_num} -> Links to Next: {next_filename}")
    
    content = re.sub(r"<title>.*?</title>", f"<title>{new_master_title}</title>", content, flags=re.IGNORECASE)
    content = re.sub(r"<h1>.*?</h1>", f"<h1>{new_master_title}</h1>", content, flags=re.IGNORECASE)
    
    # ⚠️ Dynamic insertion of the next_filename right here into the JS logic
    modal_styles = """  <style>
    .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); z-index: 9999; justify-content: center; align-items: center; }
    .modal-overlay.active { display: flex; }
    .modal-content { background: #ffffff; padding: 24px; border-radius: 12px; max-width: 400px; width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.25); position: relative; font-family: system-ui, -apple-system, sans-serif; }
    .close-modal { position: absolute; top: 12px; right: 16px; font-size: 28px; font-weight: bold; color: #666; cursor: pointer; }
    .close-modal:hover { color: #000; }
    .modal-title { margin-top: 0; color: #111; font-size: 1.3rem; display: flex; align-items: center; gap: 8px; }
    .modal-desc { color: #555; font-size: 0.95rem; line-height: 1.4; margin-bottom: 20px; }
    .modal-grid { display: flex; flex-direction: column; gap: 10px; }
    .modal-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; background: #f0f4f8; color: #1a202c; text-decoration: none; border-radius: 6px; font-weight: 500; border: 1px solid #cbd5e1; transition: all 0.2s ease; cursor: pointer; }
    .modal-btn:hover { background: #e2e8f0; border-color: #94a3b8; }
    .modal-btn.primary { background: #3182ce; color: white; border: none; }
    .modal-btn.primary:hover { background: #2b6cb0; }
    .accessibility-ctrl { display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0; }
    .btn-scale { padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 4px; background: white; cursor: pointer; }
    .btn-scale:hover { background: #f7fafc; }
  </style>\n</head>"""
    content = content.replace("</head>", modal_styles)
    
    old_home_link = '<a href="../../index.html" class="btn-nav">🏠 Home</a>'
    new_home_link = '<button onclick="toggleModal(true)" class="btn-nav" style="background: #ebf8ff; color: #2b6cb0; border: 1px solid #bee3f8; cursor: pointer;">📖 Quick Menu</button>\n      <a href="../../index.html" class="btn-nav">🏠 Home</a>'
    content = content.replace(old_home_link, new_home_link)
    
    modal_body_markup = f"""    <div id="navModal" class="modal-overlay" onclick="toggleModal(false)">
      <div class="modal-content" onclick="event.stopPropagation()">
        <span class="close-modal" onclick="toggleModal(false)">&times;</span>
        <h3 class="modal-title">🧭 Navigation Assistant</h3>
        <p class="modal-desc">You are currently viewing <strong>Chapter {chap_num}</strong> of the Class {class_num} curriculum modules.</p>
        
        <div class="modal-grid">
          <button onclick="navigateChapterSequence(-1)" class="modal-btn">← Previous Chapter</button>
          <button onclick="navigateChapterSequence(1)" class="modal-btn">Next Chapter →</button>
          <a href="../../index.html" class="modal-btn primary">🏠 Dashboard Main Menu</a>
        </div>

        <div class="accessibility-ctrl">
          <span style="font-size: 0.9rem; color: #4a5568;">Text Size:</span>
          <div style="display: flex; gap: 6px;">
            <button class="btn-scale" onclick="adjustTextSize(-0.1)">A-</button>
            <button class="btn-scale" onclick="adjustTextSize(0.1)">A+</button>
          </div>
        </div>
      </div>
    </div>

  </div>

  <script>
    function toggleModal(show) {{
      const modal = document.getElementById('navModal');
      if (show) {{
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }} else {{
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }}
    }}

    // Modernized Sequential Navigation Routing
    function navigateChapterSequence(direction) {{
      toggleModal(false);
      if (direction === -1) {{
        //history.back();
        window.location.href = "{prev_filename}";
      }} else {{
        window.location.href = "{next_filename}";
      }}
    }}

    let currentScale = 1.0;
    function adjustTextSize(delta) {{
      currentScale += delta;
      if (currentScale < 0.8) currentScale = 0.8;
      if (currentScale > 1.4) currentScale = 1.4;
      document.querySelector('.chapter-container').style.fontSize = currentScale + 'em';
    }}

    document.addEventListener('keydown', function(e) {{
      if (e.key === 'Escape') toggleModal(false);
    }});
  </script>\n</body>"""
    
    content = re.sub(r"</div>\s*</body>", modal_body_markup, content, flags=re.IGNORECASE)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    return True

patched_count = 0
for root, dirs, files in os.walk("."):
    # Pass the files list of the current directory specifically to perform localized look-aheads
    for file in files:
        if file.endswith(".html") and "chapter" in file:
            full_path = os.path.join(root, file)
            if upgrade_html_file(full_path, file, files):
                patched_count += 1

print(f"🏁 Sequential patch complete! Updated {patched_count} HTML files successfully.")
