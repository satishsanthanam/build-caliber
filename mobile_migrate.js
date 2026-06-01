const fs = require('fs');
const path = require('path');

// 🚀 FORCE OVERWRITE SWITCH: Rebuilds layouts matching the clean standard
const FORCE_REBUILD = true;

// Target paths inside your repository to scan
const targetDirectories = ['mathematics', 'science'];

function updateHtmlFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    console.log(`📂 Path layer not located here: ${dirPath}`);
    return;
  }
  
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      updateHtmlFiles(fullPath); // Recursive crawl
    } else if (path.extname(file).toLowerCase() === '.html' && file !== 'index.html') {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // 🛡️ SKIP GUARD (Bypassed if FORCE_REBUILD is true)
      if (!FORCE_REBUILD && content.includes('')) {
        console.log(`⏭️  Field Verified (Skipped): ${path.relative(process.cwd(), fullPath)}`);
        return; 
      }

      // 🔍 SMART ADAPTIVE REGEX EXTRACTION ENGINE
      const h1Match = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (!h1Match) {
        console.log(`⚠️  No h1 tag found, skipping: ${path.relative(process.cwd(), fullPath)}`);
        return;
      }
      
      const extractedTitle = h1Match[1].trim();
      const h1StartIdx = h1Match.index;
      const contentStartIdx = h1Match.index + h1Match[0].length;
      
      // Locate the exact end boundary of the document body
      const bodyCloseIdx = content.toLowerCase().lastIndexOf('</body>');
      if (bodyCloseIdx === -1) {
        console.log(`⚠️  No closing body tag found, skipping: ${path.relative(process.cwd(), fullPath)}`);
        return;
      }
      
      // Isolate everything between the header and the end of the page
      let coreHtmlContent = content.substring(contentStartIdx, bodyCloseIdx).trim();

      // 🧠 AUTO-DETECTION MATRIX: Analyze layout wrappers before the <h1> tag
      const headerPrefix = content.substring(0, h1StartIdx);
      const openDivsCount = (headerPrefix.match(/<div[^>]*>/gi) || []).length;
      const closeDivsCount = (headerPrefix.match(/<\/div>/gi) || []).length;
      
      // If there are more open divs than closing divs before H1, an old layout wrapper is present
      const hasOldOuterWrapper = openDivsCount > closeDivsCount;

      if (hasOldOuterWrapper) {
        // Strip out only the dangling outer layout wrapper div at the very end
        const lastDivIdx = coreHtmlContent.lastIndexOf('</div>');
        if (lastDivIdx !== -1) {
          coreHtmlContent = coreHtmlContent.substring(0, lastDivIdx) + coreHtmlContent.substring(lastDivIdx + 6);
        }
      }

      // 🏗️ PRISTINE SHELL RE-CONSTRUCTION (Locks perfectly into Class 6 visual format)
      const standardizedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${extractedTitle.replace(/^Chapter\s+\d+:\s*/i, '')}</title>
  <link rel="stylesheet" href="../../style.css">
  <script>
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$']],
        displayMath: [['$$', '$$']]
      },
      chtml: {
        displayAlign: 'left',
        displayIndent: '1em'
      }
    };
  </script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
</head>
<body>
  <div class="chapter-container">
    
    <div class="nav-bar">
      <a href="#" onclick="history.back(); return false;" class="btn-nav">← Back</a>
      <a href="../../index.html" class="btn-nav">🏠 Home</a>
    </div>

    <h1>${extractedTitle}</h1>

    ${coreHtmlContent.trim()}

  </div>
</body>
</html>`;

      // Overwrite with the verified mobile configuration format
      fs.writeFileSync(fullPath, standardizedHtml, 'utf8');
      console.log(`♻️  Normalized & Re-wrapped: ${path.relative(process.cwd(), fullPath)}`);
    }
  });
}

console.log("🏁 Commencing local repository adaptive migration pass...");
targetDirectories.forEach(dir => {
  let localPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(localPath)) {
    localPath = path.join(__dirname, dir);
  }
  updateHtmlFiles(localPath);
});
console.log("✅ Adaptive migration pass completed!");
