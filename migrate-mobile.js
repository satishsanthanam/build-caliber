const fs = require('fs');
const path = require('path');

// Target paths inside your repository to scan
const targetDirectories = ['mathematics', 'science'];

function updateHtmlFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      updateHtmlFiles(fullPath); // Recursive crawl
    } else if (path.extname(file).toLowerCase() === '.html' && file !== 'index.html') {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // 🛡️ SKIP GUARD: Immediately bypass files that are already marked or processed
      if (content.includes('caliber-mobile: true') || content.includes('viewport')) {
        console.log(`⏭️  Already migrated (Skipped): ${path.relative(__dirname, fullPath)}`);
        return; 
      }

      let updated = false;

      // 1. Inject the Mobile Viewport Meta Tag and Tracking Flag if missing
      if (content.includes('<meta charset="UTF-8">')) {
        content = content.replace(
          '<meta charset="UTF-8">',
          '<meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">\n  '
        );
        updated = true;
      }

      // 2. Upgrade MathJax configurations to align display layout boundaries 
      if (content.includes("displayMath: [['$$', '$$']]") && !content.includes("displayAlign: 'left'")) {
        const oldMathJax = `displayMath: [['$$', '$$']]\n      }\n    };`;
        const newMathJax = `displayMath: [['$$', '$$']]\n      },\n      chtml: {\n        displayAlign: 'left',\n        displayIndent: '1em'\n      }\n    };`;
        
        // Handle variations in newline layout tokens safely across environments (LF vs CRLF)
        if (content.includes(oldMathJax.replace(/\n/g, '\r\n'))) {
          content = content.replace(oldMathJax.replace(/\n/g, '\r\n'), newMathJax.replace(/\n/g, '\r\n'));
        } else {
          content = content.replace(oldMathJax, newMathJax);
        }
        updated = true;
      }

      if (updated) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`📱 Upgraded to mobile-first: ${path.relative(__dirname, fullPath)}`);
      }
    }
  });
}

console.log("🏁 Commencing local repository migration pass...");
targetDirectories.forEach(dir => updateHtmlFiles(path.join(__dirname, dir)));
console.log("✅ Migration pass completed!");