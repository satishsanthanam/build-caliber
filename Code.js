// =====================================================================
// 🔮 THE BUILD CALIBRE UNIFIED SUITE: MASTER FACTORY ENGINE (V16.0)
// =====================================================================

let logBuffer = [];
function log(msg) {
  Logger.log(msg);
  logBuffer.push(new Date().toLocaleTimeString() + " - " + msg);
}

/**
 * TOOL 1: THE NCERT DISCOVERY & SHEET PREP ENGINE
 */
function autoMapDriveFolderLinks() {
  Logger.log("🏁 Discovery Engine Ignition: Commencing dynamic link generation crawl...");
  
  const props = PropertiesService.getScriptProperties();
  const INVENTORY_SHEET_ID = props.getProperty("INVENTORY_SHEET_ID");
  const ROOT_DRIVE_FOLDER_ID = props.getProperty("MASTER_FOLDER_ID");
  
  const username = props.getProperty("GITHUB_USERNAME") || "your-username";
  const repo = props.getProperty("GITHUB_REPO") || "your-repo";
  const githubBaseUrl = "https://github.com/" + username + "/" + repo + "/blob/main/";
  
  if (!INVENTORY_SHEET_ID || !ROOT_DRIVE_FOLDER_ID) {
    Logger.log("❌ CONFIGURATION FAULT: Script properties INVENTORY_SHEET_ID or MASTER_FOLDER_ID are missing.");
    return;
  }

  let ss, targetSheet, dictSheet;
  try {
    ss = SpreadsheetApp.openById(INVENTORY_SHEET_ID);
    targetSheet = ss.getSheetByName("Sheet1") || ss.getSheets()[0];
    dictSheet = ss.getSheetByName("Dictionary");
  } catch (e) {
    Logger.log("❌ SCRIPT ACCESS FAULT: Unable to link to targeted sheet ID. Error: " + e.toString());
    return;
  }

  if (!dictSheet) {
    Logger.log("❌ CRITICAL ERROR: Could not find a tab named 'Dictionary'.");
    return;
  }

  const dictData = dictSheet.getDataRange().getValues();
  const dictHeaders = dictData[0];
  const dictCol = {
    code: fuzzyFindColumnIndex(dictHeaders, "Code"),
    subject: fuzzyFindColumnIndex(dictHeaders, "Subject"),
    classLevel: fuzzyFindColumnIndex(dictHeaders, "Class Level"),
    chapterNo: fuzzyFindColumnIndex(dictHeaders, "Chapter No."),
    title: fuzzyFindColumnIndex(dictHeaders, "Chapter Title")
  };

  if (dictCol.code === -1 || dictCol.subject === -1 || dictCol.classLevel === -1 || dictCol.chapterNo === -1 || dictCol.title === -1) {
    Logger.log("❌ DICTIONARY TAB FAULT: Ensure headers match precisely.");
    return;
  }

  let syllabusLookupMap = {};
  for (let d = 1; d < dictData.length; d++) {
    const dRow = dictData[d];
    const codeKey = dRow[dictCol.code].toString().toLowerCase().trim();
    if (!codeKey) continue;
    syllabusLookupMap[codeKey] = {
      subject: dRow[dictCol.subject].toString().trim(),
      classLevel: dRow[dictCol.classLevel].toString().trim(), 
      chapterNo: parseInt(dRow[dictCol.chapterNo], 10) || 0,
      title: dRow[dictCol.title].toString().trim()
    };
  }

  const data = targetSheet.getDataRange().getValues();
  const headers = data[0];
  const col = {
    subject: fuzzyFindColumnIndex(headers, "Subject"),
    classLevel: fuzzyFindColumnIndex(headers, "Class Level"),
    chapterNo: fuzzyFindColumnIndex(headers, "Chapter No."),
    title: fuzzyFindColumnIndex(headers, "Chapter Title"),
    status: fuzzyFindColumnIndex(headers, "Status"),
    path: fuzzyFindColumnIndex(headers, "GitHub Path (Auto)"),      
    githubLink: fuzzyFindColumnIndex(headers, "GitHub Link"),        
    driveLink: fuzzyFindColumnIndex(headers, "Drive Link")
  };

  if (col.subject === -1 || col.classLevel === -1 || col.chapterNo === -1 || col.title === -1 || col.path === -1 || col.driveLink === -1 || col.status === -1) {
    Logger.log("❌ TARGET SHEET FAULT: Tracking columns are missing or misspelled in Sheet1.");
    return;
  }

  if (data.length > 1) {
    targetSheet.getRange(2, 1, targetSheet.getLastRow(), headers.length).clearContent();
  }

  let rawDiscoveredFiles = [];
  try {
    const rootFolder = DriveApp.getFolderById(ROOT_DRIVE_FOLDER_ID);
    crawlAndExtractMetadataRecursively(rootFolder, rawDiscoveredFiles, syllabusLookupMap);
  } catch (driveErr) {
    Logger.log("❌ DRIVE ACCESS FAULT: " + driveErr.toString());
    return;
  }

  let newlyDiscoveredRows = [];
  rawDiscoveredFiles.forEach(function(fileObj) {
    let pathMeta = generateDeterministicFileName(fileObj.classLevelStr, fileObj.chapterInt, fileObj.computedChapterTitle);
    const subjectSubfolder = fileObj.subjectStr.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const deterministicPath = subjectSubfolder + "/" + pathMeta.folderName + "/" + pathMeta.fileName;
    const fullGithubUrl = githubBaseUrl + deterministicPath;

    let newRow = new Array(headers.length).fill("");
    newRow[col.subject] = fileObj.subjectStr;
    newRow[col.classLevel] = fileObj.classLevelStr; 
    newRow[col.chapterNo] = fileObj.chapterInt;
    newRow[col.title] = fileObj.computedChapterTitle;
    newRow[col.status] = "Pending"; 
    newRow[col.path] = deterministicPath;
    newRow[col.driveLink] = fileObj.fileUrl;
    
    if (col.githubLink !== -1) newRow[col.githubLink] = fullGithubUrl;
    newlyDiscoveredRows.push(newRow);
  });

  newlyDiscoveredRows.sort(function(a, b) {
    let subjectCompare = a[col.subject].localeCompare(b[col.subject]);
    if (subjectCompare !== 0) return subjectCompare;
    let partsA = a[col.classLevel].toString().split("-");
    let partsB = b[col.classLevel].toString().split("-");
    let classA = parseInt(partsA[0], 10) || 0;
    let classB = parseInt(partsB[0], 10) || 0;
    if (classA !== classB) return classA - classB;
    let subPartA = parseInt(partsA[1], 10) || 0;
    let subPartB = parseInt(partsB[1], 10) || 0;
    if (subPartA !== subPartB) return subPartA - subPartB;
    return a[col.chapterNo] - b[col.chapterNo];
  });

  if (newlyDiscoveredRows.length > 0) {
    targetSheet.getRange(2, col.classLevel + 1, newlyDiscoveredRows.length, 1).setNumberFormat('@');
    targetSheet.getRange(2, col.chapterNo + 1, newlyDiscoveredRows.length, 1).setNumberFormat('@');
    targetSheet.getRange(2, 1, newlyDiscoveredRows.length, headers.length).setValues(newlyDiscoveredRows);
  }
  SpreadsheetApp.flush();
  Logger.log("✅ COMPLETED: Fresh queue generated successfully with " + newlyDiscoveredRows.length + " items mapped.");
}

/**
 * TOOL 2: MAIN EXECUTION ENGINE
 */
function runBuildCaliberFactory() {
  log("🏁 Factory Ignition: Checking workspace structural boundaries...");
  const props = PropertiesService.getScriptProperties();
  const INVENTORY_SHEET_ID = props.getProperty("INVENTORY_SHEET_ID");
  const OUTPUT_FOLDER_ID = props.getProperty("OUTPUT_FOLDER_ID");
  const GEMINI_API_KEY = props.getProperty("GEMINI_API_KEY");
  
  if (!INVENTORY_SHEET_ID || !OUTPUT_FOLDER_ID || !GEMINI_API_KEY) {
    log("❌ CRITICAL ERROR: Core script properties missing from Script Properties. Exiting.");
    return;
  }

  let sheet;
  try {
    sheet = SpreadsheetApp.openById(INVENTORY_SHEET_ID).getActiveSheet();
  } catch (sheetErr) {
    log("❌ CRITICAL SHEET CONNECTION ERROR: " + sheetErr.toString());
    flushLogsToDrive();
    return;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIndex = {
    subject: headers.indexOf("Subject"),
    classLevel: headers.indexOf("Class Level"),
    chapterNo: headers.indexOf("Chapter No."),
    title: headers.indexOf("Chapter Title"),
    driveLink: headers.indexOf("Drive Link"),
    status: headers.indexOf("Status"),
    path: headers.indexOf("GitHub Path (Auto)") 
  };

  let missingHeaders = [];
  for (const [key, idx] of Object.entries(colIndex)) {
    if (idx === -1) missingHeaders.push(key);
  }
  if (missingHeaders.length > 0) {
    log("❌ CRITICAL SHEET FAULT: Missing headers: " + JSON.stringify(missingHeaders));
    flushLogsToDrive();
    return;
  }

  let taskQueue = [];
  for (let r = 1; r < data.length; r++) {
    const currentStatus = data[r][colIndex.status].toString().trim();
    if (currentStatus.includes("Pending")) {
      taskQueue.push({ rowNum: r + 1, data: data[r] });
    }
  }

  log("📊 Spreadsheet Scan Complete. Found " + taskQueue.length + " chapters queued for compilation.");
  if (taskQueue.length === 0) {
    log("🎉 All assets verified green. No 'Pending' rows found. Factory pipeline standing down.");
    flushLogsToDrive();
    return;
  }

  let promptTemplate = "";
  try {
    promptTemplate = HtmlService.createHtmlOutputFromFile("Prompt").getContent();
  } catch (err) {
    log("❌ CRITICAL ASSET FAULT: Prompt.html file containing instructions was not found.");
    flushLogsToDrive();
    return;
  }

  for (let t = 0; t < taskQueue.length; t++) {
    const task = taskQueue[t];
    const chapterNo = task.data[colIndex.chapterNo].toString().trim();
    const subject = task.data[colIndex.subject].toString().trim();
    const classLevel = task.data[colIndex.classLevel].toString().trim();
    const chapterTitle = task.data[colIndex.title].toString().trim();

    log("=========================================");
    log("🌐 Row [" + task.rowNum + "] Processing: Chapter " + chapterNo + " - " + chapterTitle + " (" + classLevel + ")");
    const driveUrl = task.data[colIndex.driveLink].toString().trim();
    let pdfBlob = null;

    if (!driveUrl || !driveUrl.includes("drive.google.com")) {
      log("❌ STORAGE FAULT: Missing or invalid Google Drive URL in row " + task.rowNum);
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("❌ MISSING LINK");
      flushLogsToDrive();
      continue;
    }

    try {
      const fileIdMatch = driveUrl.match(/[-\w]{25,}(?!.*[-\w]{25,})/);
      if (!fileIdMatch) throw new Error("Could not parse File ID.");
      pdfBlob = DriveApp.getFileById(fileIdMatch[0]).getBlob();
      log("📝 Extracted PDF layout streams straight from internal Drive space.");
    } catch (driveErr) {
      log("❌ DRIVE ACCESS FAULT: " + driveErr.toString());
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("❌ DRIVE BLOB FAULT");
      flushLogsToDrive();
      continue;
    }

    let parsedJson = null;
    try {
      const optimalModel = "gemini-3.5-flash";
      let rawResponse = "";
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          rawResponse = callGeminiAPI(pdfBlob, promptTemplate, optimalModel, GEMINI_API_KEY);
          parsedJson = JSON.parse(rawResponse);
          break;
        } catch (jsonError) {
          Logger.log(`⚠️ PARSE FAULT: Attempt #${attempts} failed to parse.`);
          if (attempts >= maxAttempts) throw jsonError;
          Utilities.sleep(2000);
        }
      }

      if (!parsedJson || !parsedJson.html_content || !parsedJson.output_filename) {
        throw new Error("Crucial JSON fields returned empty from the model.");
      }
    } catch (parseError) {
      log("❌ PARSE FAULT: AI execution stalled. Error: " + parseError.toString());
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("⚠️ Output Truncated");
      continue;
    }

    let pathMeta = generateDeterministicFileName(classLevel, chapterNo, chapterTitle);
    let computedFileName = pathMeta.fileName;
    let sanitizedClass = pathMeta.folderName;
    let baseClassNum = pathMeta.baseClassNum;
    let bookPartNum = pathMeta.bookPartNum;
    
    const sanitizedSubject = subject.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const finalPath = sanitizedSubject + "/" + sanitizedClass + "/" + computedFileName;

    // 🔍 DUAL-DIRECTION BI-DIRECTIONAL SEQUENCE SCANNER
    let cleanDisplayChapter = parseInt(chapterNo, 10);
    let prevFileName = "../../index.html"; 
    let nextFileName = "../../index.html"; 
    let prevTargetChap = cleanDisplayChapter - 1;
    let nextTargetChap = cleanDisplayChapter + 1;

    for (let checkR = 1; checkR < data.length; checkR++) {
      let checkSub = data[checkR][colIndex.subject].toString().trim();
      let checkClass = data[checkR][colIndex.classLevel].toString().trim();
      let checkChap = parseInt(data[checkR][colIndex.chapterNo], 10);

      if (checkSub === subject && checkClass === classLevel) {
        if (checkChap === prevTargetChap) {
          let prevTitle = data[checkR][colIndex.title].toString().trim();
          let prevMeta = generateDeterministicFileName(checkClass, checkChap, prevTitle);
          prevFileName = prevMeta.fileName;
        }
        if (checkChap === nextTargetChap) {
          let nextTitle = data[checkR][colIndex.title].toString().trim();
          let nextMeta = generateDeterministicFileName(checkClass, checkChap, nextTitle);
          nextFileName = nextMeta.fileName;
        }
      }
    }

    let formattedSubjectPrefix = subject.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    let bookLabel = bookPartNum ? ` (Book ${bookPartNum})` : '';
    let masterSearchHeaderTitle = `${formattedSubjectPrefix}: Class ${baseClassNum}${bookLabel} — Chapter ${cleanDisplayChapter}: ${parsedJson.extracted_chapter_title || chapterTitle}`;

    let completeWebPageContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${masterSearchHeaderTitle}</title>
  <link rel="stylesheet" href="../../style.css">
  <style>
    /* 🛡️ DEFENSIVE TEXT ALIGNMENT LAYER FOR COLLAPSIBLE ACCORDIONS */
    details.topic-box > p, details.sub-topic > p { padding-left: 14px !important; margin-left: 0 !important; }
    details.topic-box ol, details.sub-topic ol { list-style-type: decimal !important; padding-left: 32px !important; margin-left: 10px !important; display: block !important; }
    details.topic-box ul, details.sub-topic ul { list-style-type: disc !important; padding-left: 32px !important; margin-left: 10px !important; display: block !important; }
    details.topic-box li, details.sub-topic li { margin-bottom: 6px !important; display: list-item !important; }
    
    /* 🚨 FIXED: EMBEDDED DEFENSIVE CONTAINER PATCh FOR MOBILE OVerFLOW SCROLLBARS */
    table { 
      width: 100% !important; 
      border-collapse: collapse !important; 
      margin: 16px 0 !important; 
      display: block !important;  
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch;
      box-sizing: border-box !important; 
    }
    th, td { 
      padding: 10px 12px !important; 
      text-align: left !important; 
      border: 1px solid #94a3b8 !important; 
      min-width: 140px !important;
    }
    th { 
      background-color: #f1f5f9 !important; 
      font-weight: 600 !important; 
      border-bottom: 2px solid #475569 !important;
      white-space: nowrap !important;
    }
    blockquote.example-block { width: 100% !important; box-sizing: border-box !important; margin: 16px 0 !important; padding: 16px !important; background: #f8fafc !important; border-left: 4px solid #3182ce !important; }
    
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
  </style>
  <script>
    window.MathJax = { tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']] }, chtml: { displayAlign: 'left', displayIndent: '1em' } };
  </script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
</head>
<body>
  <div class="chapter-container">
    <div class="nav-bar">
      <a href="#" onclick="history.back(); return false;" class="btn-nav">← Back</a>
      <button onclick="toggleModal(true)" class="btn-nav" style="background: #ebf8ff; color: #2b6cb0; border: 1px solid #bee3f8; cursor: pointer;">📖 Quick Menu</button>
      <a href="../../index.html" class="btn-nav">🏠 Home</a>
    </div>

    <h1>\${masterSearchHeaderTitle}</h1>
    \${parsedJson.html_content}

    <div id="navModal" class="modal-overlay" onclick="toggleModal(false)">
      <div class="modal-content" onclick="event.stopPropagation()">
        <span class="close-modal" onclick="toggleModal(false)">&times;</span>
        <h3 class="modal-title">🧭 Navigation Assistant</h3>
        <p class="modal-desc">You are currently viewing <strong>Chapter \${cleanDisplayChapter}</strong> of the Class \${baseClassNum} curriculum modules.</p>
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
    function toggleModal(show) { const modal = document.getElementById('navModal'); if (show) { modal.classList.add('active'); document.body.style.overflow = 'hidden'; } else { modal.classList.remove('active'); document.body.style.overflow = ''; } }
    function navigateChapterSequence(direction) { toggleModal(false); if (direction === -1) { window.location.href = "\${prevFileName}"; } else { window.location.href = "\${nextFileName}"; } }
    let currentScale = 1.0;
    function adjustTextSize(delta) { currentScale += delta; if (currentScale < 0.8) currentScale = 0.8; if (currentScale > 1.4) currentScale = 1.4; document.querySelector('.chapter-container').style.fontSize = currentScale + 'em'; }
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') toggleModal(false); });
  </script>
</body>
</html>`;

    // Rest of your GitHub payload handling code follows cleanly...
    const stagingBranchName = "develop";
    const commitSuccess = pushFileToGitHub(finalPath, completeWebPageContent, stagingBranchName);

    if (commitSuccess) {
      log("🚀 PIPELINE SUCCESS: File safely deployed straight to GitHub -> " + finalPath);
      appendToCompletedLog(finalPath, parsedJson.index_update);
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("✅ Completed");
      sheet.getRange(task.rowNum, colIndex.path + 1).setValue(finalPath);
    } else {
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("❌ GitHub Deploy Fault");
    }

    SpreadsheetApp.flush();
    logBuffer = []; 
    Utilities.sleep(4000);
  }
}

/**
 * SHARED COMPONENT: AUTOMATED PATH RESOLUTION ENGINE
 */
function generateDeterministicFileName(classLevel, chapterNo, chapterTitle) {
  let cleanClassStr = classLevel.toString().trim();
  let baseClassNum = parseInt(cleanClassStr.match(/\d+/)?.[0] || "0", 10);
  let bookPartNum = "";
  
  let dashMatch = cleanClassStr.match(/^\d+-(\d+)/);
  if (dashMatch) {
    bookPartNum = dashMatch[1];
  } else {
    let partMatch = cleanClassStr.match(/(?:part|volume|term|vol)[-_\s]*(\d+)/i);
    if (partMatch) bookPartNum = partMatch[1];
  }
  
  let fileClassPrefix = !isNaN(baseClassNum) ? ("0" + baseClassNum).slice(-2) : "00";
  if (bookPartNum) {
    fileClassPrefix = baseClassNum + "-" + bookPartNum; 
  }
  
  let cleanChapNum = parseInt(chapterNo, 10);
  let nnStr = chapterNo !== "999" && !isNaN(cleanChapNum) ? ("0" + cleanChapNum).slice(-2) : "00";
  
  let titleStr = chapterTitle.toString().trim();
  if (/[^\x00-\x7F]/.test(titleStr)) {
    try {
      titleStr = LanguageApp.translate(titleStr, '', 'en');
    } catch (e) { }
  }
  
  let topicSlug = titleStr.toLowerCase().replace(/[^a-z0-9\s-_]/g, "").replace(/[\s-_]+/g, "-").trim();
  if (topicSlug.startsWith("-")) topicSlug = topicSlug.substring(1);
  if (topicSlug.endsWith("-")) topicSlug = topicSlug.substring(0, topicSlug.length - 1);
  
  let truncatedSlug = topicSlug.substring(0, 34);
  if (truncatedSlug.endsWith("-")) truncatedSlug = truncatedSlug.substring(0, truncatedSlug.length - 1);
  
  return {
    fileName: fileClassPrefix + "-chapter-" + nnStr + "-" + truncatedSlug + ".html",
    folderName: "class-" + baseClassNum + (bookPartNum ? "-" + bookPartNum : ""),
    baseClassNum: baseClassNum,
    bookPartNum: bookPartNum
  };
}

/**
 * SHARED COMPONENT: RECURSIVE DRIVE PARSER
 */
function crawlAndExtractMetadataRecursively(currentFolder, rawDiscoveredFiles, syllabusLookupMap) {
  const alphabetToClass = { 'a': 1, 'b': 2, 'c': 3, 'd': 4, 'e': 5, 'f': 6, 'g': 7, 'h': 8, 'i': 9, 'j': 10, 'k': 11, 'l': 12 };
  const files = currentFolder.getFiles();
  
  while (files.hasNext()) {
    const file = files.next();
    const rawName = file.getName().toLowerCase().replace(/\.[^/.]+$/, "").trim(); 
    const firstChar = rawName.charAt(0);
    
    if (alphabetToClass[firstChar]) {
      const classNum = alphabetToClass[firstChar];
      let subjectStr = "Mathematics";
      if (rawName.includes("esc")) subjectStr = "Science";

      const digitMatch = rawName.match(/\d+$/);
      if (digitMatch) {
        const rawDigits = digitMatch[0]; 
        let chapterInt = parseInt(rawDigits.slice(-2), 10); 
        let partNum = 1;
        if (rawDigits.length >= 3) partNum = parseInt(rawDigits.slice(-3, -2), 10) || 1;

        let computedChapterTitle = "Chapter " + chapterInt;
        let classLevelStr = partNum > 1 ? classNum + "-" + partNum : classNum.toString();

        if (syllabusLookupMap[rawName]) {
          subjectStr = syllabusLookupMap[rawName].subject;
          if (syllabusLookupMap[rawName].chapterNo) chapterInt = syllabusLookupMap[rawName].chapterNo;
          computedChapterTitle = syllabusLookupMap[rawName].title;
          classLevelStr = syllabusLookupMap[rawName].classLevel.toString().trim();
        }

        rawDiscoveredFiles.push({
          fileUrl: file.getUrl(),
          rawName: rawName,
          classNum: classNum,
          subjectStr: subjectStr,
          chapterInt: chapterInt,
          classLevelStr: classLevelStr, 
          computedChapterTitle: computedChapterTitle
        });
      }
    }
  }
  const subFolders = currentFolder.getFolders();
  while (subFolders.hasNext()) {
    crawlAndExtractMetadataRecursively(subFolders.next(), rawDiscoveredFiles, syllabusLookupMap);
  }
}

function callGeminiAPI(pdfBlob, promptText, modelName, apiKey) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":generateContent?key=" + apiKey;
  const payload = {
    "contents": [{ "parts": [
      { "inlineData": { "mimeType": "application/pdf", "data": Utilities.base64Encode(pdfBlob.getBytes()) } },
      { "text": promptText }
    ]}],
    "generationConfig": {
      "responseMimeType": "application/json",
      "responseSchema": {
        "type": "OBJECT",
        "properties": {
          "extracted_chapter_title": { "type": "STRING" },
          "output_filename": { "type": "STRING" },
          "html_content": { "type": "STRING" },
          "index_update": { "type": "STRING" }
        },
        "required": ["extracted_chapter_title", "output_filename", "html_content", "index_update"]
      },
      "temperature": 0.1,
      "maxOutputTokens": 32768
    }
  };
  const options = { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload), "muteHttpExceptions": true };
  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  if (response.getResponseCode() !== 200) throw new Error("HTTP " + response.getResponseCode() + ": " + (json.error ? json.error.message : "API Error"));
  return json.candidates[0].content.parts[0].text;
}

function pushFileToGitHub(filePath, fileContent, branchName) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("GITHUB_PAT");         
  const username = props.getProperty("GITHUB_USERNAME");
  const repo = props.getProperty("GITHUB_REPO");         
  if (!token || !username || !repo) return false;
  
  const url = "https://api.github.com/repos/" + username + "/" + repo + "/contents/" + filePath;
  let fileSha = null;
  const checkOptions = { "method": "get", "headers": { "Authorization": "token " + token, "Accept": "application/vnd.github.v3+json" }, "muteHttpExceptions": true };
  const checkResponse = UrlFetchApp.fetch(url, checkOptions);
  if (checkResponse.getResponseCode() === 200) fileSha = JSON.parse(checkResponse.getContentText()).sha;
  
  const commitPayload = { "message": "pipeline automation: compile layout structure for " + filePath, "content": Utilities.base64Encode(Utilities.newBlob(fileContent).getBytes()), "branch": branchName };
  if (fileSha) commitPayload["sha"] = fileSha; 
  
  const pushOptions = { "method": "put", "contentType": "application/json", "headers": { "Authorization": "token " + token, "Accept": "application/vnd.github.v3+json" }, "payload": JSON.stringify(commitPayload), "muteHttpExceptions": true };
  const pushResponse = UrlFetchApp.fetch(url, pushOptions);
  return pushResponse.getResponseCode() === 200 || pushResponse.getResponseCode() === 201;
}

function appendToCompletedLog(githubPath, indexSnippet) {
  try {
    const folderId = PropertiesService.getScriptProperties().getProperty("OUTPUT_FOLDER_ID");
    if (!folderId) return;
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByName("completed.txt");
    let file = files.hasNext() ? files.next() : folder.createFile("completed.txt", "", MimeType.PLAIN_TEXT);
    const cur = file.getBlob().getDataAsString();
    let logEntry = "File: " + githubPath;
    if (indexSnippet) logEntry += "\nSnippet:\n" + indexSnippet + "\n--------------------";
    file.setContent(cur ? cur + "\n" + logEntry : logEntry);
  } catch (e) { }
}

function flushLogsToDrive() {
  try {
    const folderId = PropertiesService.getScriptProperties().getProperty("OUTPUT_FOLDER_ID");
    if (!folderId || logBuffer.length === 0) return;
    const folder = DriveApp.getFolderById(folderId);
    const title = "build-calibre-log-" + new Date().toISOString().slice(0, 10) + ".txt";
    const files = folder.getFilesByName(title);
    let file = files.hasNext() ? files.next() : folder.createFile(title, "", MimeType.PLAIN_TEXT);
    file.setContent(file.getBlob().getDataAsString() + logBuffer.join("\n") + "\n");
    logBuffer = [];
  } catch (e) { }
}

function fuzzyFindColumnIndex(headers, targetName) {
  const cleanTarget = targetName.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (let i = 0; i < headers.length; i++) {
    if (headers[i].toString().toLowerCase().replace(/[^a-z0-9]/g, "") === cleanTarget) return i;
  }
  return -1;
}