/**
 * DYNAMIC COLLAPSIBLE NAVIGATION BUILDING ENGINE (v2 - CACHE OVERRIDE)
 * Sweeps through completed components and builds a clean interface.
 * REBRAND: Updated to Build Calibre identity.
 * FIX: Enforces direct class-level safety buffers to eliminate icon layout overlap.
 */
function buildDynamicIndexv2() {
  const props = PropertiesService.getScriptProperties();
  const INVENTORY_SHEET_ID = props.getProperty("INVENTORY_SHEET_ID");
  
  if (!INVENTORY_SHEET_ID) {
    Logger.log("❌ ERROR: INVENTORY_SHEET_ID missing.");
    return;
  }

  const sheet = SpreadsheetApp.openById(INVENTORY_SHEET_ID).getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const col = {
    subject: headers.indexOf("Subject"),
    classLevel: headers.indexOf("Class Level"),
    chapterNo: headers.indexOf("Chapter No."),
    title: headers.indexOf("Chapter Title"),
    status: headers.indexOf("Status"),
    path: headers.indexOf("Bitbucket Path (Auto)")
  };

  const curriculumMap = {};
  let completedCount = 0;

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (row[col.status] === "✅ Completed") {
      const subj = row[col.subject].toString().trim();
      const cls = row[col.classLevel].toString().trim();
      const chapNo = parseInt(row[col.chapterNo], 10);
      const title = row[col.title].toString().trim();
      const path = row[col.path].toString().trim();

      if (!curriculumMap[subj]) curriculumMap[subj] = {};
      if (!curriculumMap[subj][cls]) curriculumMap[subj][cls] = [];

      const stableChapNo = isNaN(chapNo) ? 999 : chapNo;
      curriculumMap[subj][cls].push({ no: stableChapNo, title: title, path: path });
      completedCount++;
    }
  }

  if (completedCount === 0) {
    Logger.log("⚠️ No completed chapters found in the sheet. Index generation halted.");
    return;
  }

  let html = `<!DOCTYPE html>
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
    
    /* 🧱 UNBREAKABLE BUFFER ZONE: Forces structural padding onto the target elements to prevent icon collision */
    .topic-title, .class-title { 
      display: block !important;
      position: relative !important; 
      padding: 6px 10px 6px 45px !important; /* 📦 45px left gutter safety barrier */
      cursor: pointer;
      box-sizing: border-box;
      outline: none !important;
      list-style: none !important;
    }
    
    .topic-title { font-size: 1.3em; font-weight: bold; color: #2c3e50; }
    .class-title { font-size: 1.1em; font-weight: 600; color: #34495e; margin-top: 10px; }
    
    summary::-webkit-details-marker { display: none !important; }
    summary::marker { display: none !important; content: "" !important; }
    summary:hover { color: #0056b3; }
    
    /* 🎨 PINPOINT INDICATOR POSITIONING: Anchors and aligns elements perfectly to the center line */
    .topic-title::before, .class-title::before { 
      content: '[+]' !important; 
      position: absolute !important; 
      left: 12px !important; 
      top: 50% !important;
      transform: translateY(-50%) !important; /* Perfect vertical alignment center */
      font-weight: bold !important; 
      color: #0056b3 !important; /* 🔵 Theme Blue */
      font-size: 1em !important; 
      font-family: monospace !important;
    }
    details[open] > .topic-title::before,
    details[open] > .class-title::before { 
      content: '[-]' !important; 
      color: #e67e22 !important; /* 🟠 Theme Orange */
    }
  </style>
</head>
<body>
  <div class="nav-bar" style="margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 10px;">
    <h2>Build Calibre Curriculum Database</h2>
  </div>\n`;

  for (const subj in curriculumMap) {
    html += `  <div class="topic-box">\n    <details>\n      <summary class="topic-title">Subject: ${subj}</summary>\n`;
    for (const cls in curriculumMap[subj]) {
      html += `      <div class="sub-topic" style="margin-left: 20px;">\n        <details>\n          <summary class="class-title">${cls}</summary>\n          <ul class="clean-list">\n`;
      
      curriculumMap[subj][cls].sort((a, b) => a.no - b.no);

      curriculumMap[subj][cls].forEach(chapter => {
        let displayTitle = (chapter.no === 999) ? chapter.title : `<strong>Chapter ${chapter.no}:</strong> ${chapter.title}`;
        html += `            <li class="chapter-row"><span class="keyword"><a href="${chapter.path}">${displayTitle}</a></span></li>\n`;
      });
      
      html += `          </ul>\n        </details>\n      </div>\n`;
    }
    html += `    </details>\n  </div>\n`;
  }

  html += `</body>\n</html>`;

  const success = pushFileToBitbucketWithJira("index.html", html, "factory-builds");
  if (success) {
    Logger.log("✅ SUCCESS: Immaculate Build Calibre index layout compiled and pushed via v2!");
  }
}