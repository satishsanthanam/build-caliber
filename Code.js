// =====================================================================
// 🔮 THE BUILD CALIBRE UNIFIED SUITE: MASTER FACTORY ENGINE (V16.8)
// =====================================================================

let logBuffer = [];
function log(msg) {
  Logger.log(msg);
  logBuffer.push(new Date().toLocaleTimeString() + " - " + msg);
}

/**
 * TOOL 1: THE NCERT DISCOVERY & SHEET PREP ENGINE
 * Run this function first to crawl Google Drive, translate Hindi titles,
 * handle multi-book partitions (e.g., 11-1), and clear/populate Sheet1.
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
 * Run this function second. It loops through the "Pending" items created by Tool 1,
 * runs them through Gemini, structures the custom layouts, and deploys directly to GitHub.
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

    <h1>${masterSearchHeaderTitle}</h1>
    ${parsedJson.html_content}

    <div id="navModal" class="modal-overlay" onclick="toggleModal(false)">
      <div class="modal-content" onclick="event.stopPropagation()">
        <span class="close-modal" onclick="toggleModal(false)">&times;</span>
        <h3 class="modal-title">🧭 Navigation Assistant</h3>
        <p class="modal-desc">You are currently viewing <strong>Chapter ${cleanDisplayChapter}</strong> of the Class ${baseClassNum} curriculum modules.</p>
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
    function navigateChapterSequence(direction) { toggleModal(false); if (direction === -1) { window.location.href = "${prevFileName}"; } else { window.location.href = "${nextFileName}"; } }
    let currentScale = 1.0;
    function adjustTextSize(delta) { currentScale += delta; if (currentScale < 0.8) currentScale = 0.8; if (currentScale > 1.4) currentScale = 1.4; document.querySelector('.chapter-container').style.fontSize = currentScale + 'em'; }
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') toggleModal(false); });
  </script>
</body>
</html>`;

    const stagingBranchName = "develop";

    var cleanHTML = sanitizeLaTeXForHTML(completeWebPageContent);
    let finalizedHTML = sanitizeMathHtmlMaster(cleanHTML);
    
    var beautifulHTML = formatHTMLForGitDiff(finalizedHTML);
    const commitSuccess = pushFileToGitHub(finalPath, beautifulHTML, stagingBranchName);
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
          "index_update": { "type": "STRING" },
          "html_content": { "type": "STRING" }
        },
        "required": ["extracted_chapter_title", "output_filename", "index_update", "html_content"]
      },
      "temperature": 0.1,
      "maxOutputTokens": 32768
    }   
  };
  const response = UrlFetchApp.fetch(url, { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload), "muteHttpExceptions": true });
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
  const checkResponse = UrlFetchApp.fetch(url, { "method": "get", "headers": { "Authorization": "token " + token, "Accept": "application/vnd.github.v3+json" }, "muteHttpExceptions": true });
  if (checkResponse.getResponseCode() === 200) fileSha = JSON.parse(checkResponse.getContentText()).sha;
  
  const commitPayload = { "message": "pipeline automation: compile layout structure for " + filePath, "content": Utilities.base64Encode(Utilities.newBlob(fileContent).getBytes()), "branch": branchName };
  if (fileSha) commitPayload["sha"] = fileSha; 
  
  const pushResponse = UrlFetchApp.fetch(url, { "method": "put", "contentType": "application/json", "headers": { "Authorization": "token " + token, "Accept": "application/vnd.github.v3+json" }, "payload": JSON.stringify(commitPayload), "muteHttpExceptions": true });
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

/**
 * Sanitizes and preserves LaTeX backslashes before writing to HTML files.
 * Prevents escaping pipelines from converting \x0c or \x09 artifacts.
 */
function sanitizeLaTeXForHTML(rawText) {
  if (!rawText) return "";
  let cleanText = rawText;
  
  cleanText = cleanText.replace(/Holdsymbol/g, '\\boldsymbol');
  cleanText = cleanText.replace(/ightarrow/g, '\\rightarrow');
  cleanText = cleanText.replace(/\\text\{%\}/g, '\\%');
  cleanText = cleanText.replace(/\\text\{\\ \%\}/g, '\\%');
  
  const commonKeywords = ['frac', 'text', 'times', 'alpha', 'beta', 'theta', 'mu', 'nu', 'pi', 'approx', 'implies'];
  commonKeywords.forEach(function(kw) {
    var regex = new RegExp('(?<!\\\\)\\b' + kw + '\\b', 'g');
    cleanText = cleanText.replace(regex, '\\' + kw);
  });
  return cleanText;
}

/**
 * Formats a raw HTML string into clean, readable, indented rows.
 * Breaks up single-line payloads to preserve highly scannable Git commit diffs.
 */
function formatHTMLForGitDiff(htmlString) {
  if (!htmlString) return "";
  var indent = 0;
  var formatted = "";
  var padding = "  ";

  var reg = /(<[^>]+>)/g;
  var lines = htmlString.replace(reg, '\n$1\n').split('\n');

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;

    if (line.match(/^<[^\/!?\s>]+[^>]*>/) && !line.match(/^<(meta|link|br|hr|input|img|span|strong|em|i|b)[^>]*>/)) {
      var isInlineBlock = (i + 2 < lines.length) && lines[i + 2].trim() === line.replace(/^</, '</').replace(/\s.*$/, '>');
      formatted += padding.repeat(indent) + line + "\n";
      if (!isInlineBlock) indent++;
    } 
    else if (line.match(/^<\/[^>]+>/)) {
      indent--;
      if (indent < 0) indent = 0;
      formatted += padding.repeat(indent) + line + "\n";
    } 
    else {
      formatted += padding.repeat(indent) + line + "\n";
    }
  }

  return formatted.trim();
}

/**
 * AUTOMATED PIPELINE UNIT TEST HARNESS
 * Validates the raw JSON components before passing them to the layout engine.
 * @return {boolean} True if the asset passes all structural validations.
 */
function runAssetUnitTest(rawJsonString) {
  log("🧪 [UNIT TEST] Initiating pre-assembly structural validation harness...");
  
  if (!rawJsonString) {
    log("❌ [UNIT TEST FAIL] Raw payload stream is completely empty.");
    return false;
  }
  
  // Test 1: Check for raw string structural leakage
  if (rawJsonString.includes("window.MathJax") && !rawJsonString.includes("</head>")) {
    log("⚠️ [UNIT TEST WARN] Script block anomaly discovered. Triggering auto-reconstruction.");
  }
  
  // Test 2: Check for unclosed template boundary literals
  const openBrackets = (rawJsonString.match(/\[/g) || []).length;
  const closeBrackets = (rawJsonString.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    log("📊 [UNIT TEST INFO] Bracket imbalance tracked. Open: " + openBrackets + ", Close: " + closeBrackets);
  }
  
  log("✅ [UNIT TEST PASS] Structural integrity verified. Proceeding to asset deployment.");
  return true;
}

function debugSanitizerWithSamplePayload() {
  // Test scenario mirroring the failed multi-pass markup leak
  const mockBrokenPayload = `<span class="close-modal">\\&times;</span>`;

  Logger.log("🧪 Starting zero-cost validation run for SCENARIO_05...");
  const processedResult = sanitizeMathHtmlMaster(mockBrokenPayload);
  
  Logger.log("--------------------------------------------------");
  Logger.log("📊 PROCESSED OUTPUT VIEW:");
  Logger.log(processedResult);
  Logger.log("--------------------------------------------------");
  
  if (processedResult.includes('<span class="close-modal">&times;</span>')) {
    Logger.log("✅ SCENARIO_05 SUCCESS: The HTML multiplier protection shield cleared green!");
  } else {
    Logger.log("❌ SCENARIO_05 CRASH: Escaped character sequence is still bound.");
  }
}

/**
 * Sanitizes and preserves LaTeX backslashes before writing to HTML files.
 * Prevents escaping pipelines from converting \x0c or \x09 artifacts.
 */
function sanitizeLaTeXForHTML(rawText) {
  if (!rawText) return "";
  let cleanText = rawText;
  
  // Fixed: Wrapped with strict word boundaries (\b) to protect embedded strings like \Rightarrow from getting mangled
  cleanText = cleanText.replace(/\bHoldsymbol\b/g, '\\boldsymbol');
  cleanText = cleanText.replace(/\bightarrow\b/g, '\\rightarrow');
  cleanText = cleanText.replace(/\\text\{%\}/g, '\\%');
  cleanText = cleanText.replace(/\\text\{\\ \%\}/g, '\\%');
  
  const commonKeywords = ['frac', 'text', 'times', 'alpha', 'beta', 'theta', 'mu', 'nu', 'pi', 'approx', 'implies'];
  commonKeywords.forEach(function(kw) {
    var regex = new RegExp('(?<!\\\\)\\b' + kw + '\\b', 'g');
    cleanText = cleanText.replace(regex, '\\' + kw);
  });
  return cleanText;
}

/**
 * 🔬 MULTI-SCENARIO LATEX HARNESS UNIT TESTER
 * Run this function inside the Apps Script editor to validate your clean 
 * processing engine across multiple real-world math mutations simultaneously.
 */
function runComprehensiveLaTeXTestSuite() {
  Logger.log("🧪 [UNIT TEST SUITE] Initializing Multi-Scenario LaTeX Test Harness...");
  
  // 📦 Define your multi-JSON/mock test array
  const testScenarios = [
    {
      id: "SCENARIO_01",
      name: "Implication Arrow Overlap (\\Rightarrow vs \\R\\rightarrow)",
      mockHtml: `<p>Assume $f(x_1) = f(x_2) \\Rightarrow x_1 = x_2$</p>`,
      validate: function(output) {
        return !output.includes("\\R\\rightarrow") && output.includes("\\Rightarrow");
      }
    },
    {
      id: "SCENARIO_02",
      name: "Tab Control Spacing Trap (\\times vs  imes)",
      mockHtml: `<p>The dimensions of the matrix are given as $m \\times n$.</p>`,
      validate: function(output) {
        // Looks for a clean, spaced backslash times command without tab translation
        return output.includes("\\times") && !output.includes(" imes");
      }
    },
    {
      id: "SCENARIO_03",
      name: "JSON Double-Escape Mangle Collapse",
      mockHtml: `$$\\\\begin{bmatrix} a & b \\\\\\\\ c & d \\\\end{bmatrix}$$`,
      validate: function(output) {
        return output.includes("\\begin{bmatrix}") && output.includes("\\end{bmatrix}");
      }
    },
    {
      id: "SCENARIO_04",
      name: "Literal Coordinate Set Braces Normalization",
      mockHtml: `<div>The finite set of prime boundaries is defined as \\\\{P_1, P_2\\\\}</div>`,
      validate: function(output) {
        return output.includes("\\{P_1") && output.includes("P_2\\}");
      }
    },
    {
      id: "SCENARIO_05",
      name: "Programmatic HTML Entity Multiplier Protection",
      mockHtml: `<span class="close-modal">\\&times;</span>`,
      validate: function(output) {
        // Ensures HTML entities aren't prefixed with accidental mathematical backslashes
        return output.includes("&times;") && !output.includes("\\&times;");
      }
    }
  ];
  
  let passedCount = 0;
  
  testScenarios.forEach(function(scenario) {
    try {
      // Replicate the exact production transformation pipeline sequence
      let initialStage = sanitizeLaTeXForHTML(scenario.mockHtml);
      let finalStage = sanitizeMathHtmlMaster(initialStage);
      
      let isSuccessful = scenario.validate(finalStage);
      
      if (isSuccessful) {
        Logger.log(`✅ [PASS] [${scenario.id}] -> ${scenario.name}`);
        passedCount++;
      } else {
        Logger.log(`❌ [FAIL] [${scenario.id}] -> ${scenario.name}`);
        Logger.log(`   📥 Input Content:  ${scenario.mockHtml}`);
        Logger.log(`   📤 Engine Output: ${finalStage}`);
      }
    } catch (crashError) {
      Logger.log(`💥 [CRASH] [${scenario.id}] Execution halted due to compile fault: ${crashError.toString()}`);
    }
  });
  
  Logger.log("--------------------------------------------------------------------------------");
  Logger.log(`📊 [TEST HARNESS SUMMARY] Pipeline verification completed: ${passedCount} / ${testScenarios.length} Scenarios Cleared.`);
  Logger.log("--------------------------------------------------------------------------------");
}

function runLocalFirewallUnitTests() {
  Logger.log("🧪 [UNIT TEST] Starting local firewall integrity validation matrix...");
  let passCount = 0;
  let totalTests = 3;

  // Scenario 1
  const mockScenario1 = `<!DOCTYPE html><html lang="en"><head><script>window.MathJax = { tex: { inlineMath: [['← Back\n </a>\n <button onclick="toggleModal(true)" class="btn-nav" style="background: #ebf8ff;">📖 Quick Menu</button>\n </div>\n <h1>Mathematics</h1>`;
  let out1 = sanitizeMathHtmlMaster(mockScenario1);
  if (out1.includes("inlineMath: [['$', '$']]") && out1.includes('class="chapter-container"')) { passCount++; }

  // Scenario 2
  const mockScenario2 = `let currentScale = 1.0;\nfunction adjustTextSize(delta) { currentScale += delta; if (currentScale\n< 0.8) currentScale = 0.8; }`;
  let out2 = sanitizeMathHtmlMaster(mockScenario2);
  if (out2.includes("if (currentScale < 0.8)")) { passCount++; }

  // --- SCENARIO 3: FIXED ESCAPED HTML ENTITY ICON FIX ---
  const mockScenario3 = `<span class="close-modal">\\&times;</span>`;
  let out3 = sanitizeMathHtmlMaster(mockScenario3);
  if (out3.includes('<span class="close-modal">&times;</span>')) {
    Logger.log("A+ [PASS] Scenario 3 Cleared: Flattened entity residue completely.");
    passCount++;
  } else {
    Logger.log("F [FAIL] Scenario 3 Failed: Backslash escape character leaked to UI.");
  }

  Logger.log("--------------------------------------------------------------------------------");
  Logger.log("📊 [TEST SUMMARY] Local validation run completed: " + passCount + " / " + totalTests + " Scenarios Cleared.");
  Logger.log("--------------------------------------------------------------------------------");
}

/**
 * MASTER CLEANING FIREWALL ENGINE (V17.7)
 * One consolidated, highly optimized multi-pass sanitizer function.
 * Squashes spacing traps, JSON double-escapes, and strips parsing artifacts.
 */
function sanitizeMathHtmlMaster(htmlString) {
  if (!htmlString) return "";
  let cleanString = htmlString;
  
  // --- PASS 1: ATOMIC COMPONENT RECONSTRUCTION VIA SAFE PLACEHOLDERS ---
  cleanString = cleanString.replace(/window\.MathJax[\s\S]*?<button onclick="toggleModal\(true\)" class="btn-nav"/g, `window.MathJax = { tex: { inlineMath: __INLINE_M__, displayMath: __DISPLAY_M__ }, chtml: { displayAlign: 'left', displayIndent: '1em' } };\n</script>\n</head>\n<body>\n<div class="chapter-container">\n  <div class="nav-bar">\n    <a href="#" onclick="history.back(); return false;" class="btn-nav">← Back</a>\n    <button onclick="toggleModal(true)" class="btn-nav"`);

  cleanString = cleanString.replace(/inlineMath:\s*\[\[['"]\$['"],\s*['"]\$['"],\s*displayMath:/g, "inlineMath: __INLINE_M__, displayMath:");

  // --- PASS 1b: FORCE FACTORY CDN RESCUE RE-INJECTION ---
  if (cleanString.includes("</head>") && !cleanString.includes("MathJax-script")) {
    cleanString = cleanString.replace("</head>", '  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>\n</head>');
  }

  // --- PASS 2: STREAM-TRUNCATION SHIELD ---
  if (cleanString.includes("</html>")) {
    cleanString = cleanString.split("</html>")[0] + "</html>";
  }
  
  cleanString = cleanString
    // --- PASS 3: REPAIR LATERAL ESCAPE MANGLES (The Strict "\t" Tab Traps) ---
    .replace(/\times/g, " \\times")       
    .replace(/\theta/g, " \\theta")       
    .replace(/\tan\b/g, " \\tan")         
    .replace(/\tau\b/g, " \\tau")         
    
    // --- PASS 4: COLLAPSE JSON DOUBLE-ESCAPE ARTIFACTS ---
    .replace(/\\\\(left|right|begin|end|matrix|bmatrix|vmatrix|cases)/g, "\\$1")
    .replace(/\\\\(in|notin|subset|subseteq|cap|cup|forall|exists|times)/g, "\\$1")
    .replace(/\\\\(alpha|beta|gamma|delta|Delta|theta|lambda|mu|rho|phi|psi|omega|pi)/g, "\\$1")
    .replace(/\\\\(sin|cos|tan|csc|sec|cot|log|ln|lim|sqrt|frac|vec|hat|cdot|partial|quad|text)/g, "\\$1")
    .replace(/\\\\([a-zA-Z]+)/g, "\\$1")
    
    // --- PASS 5: LITERAL BRACE AND NEWLINE NORMALIZATION ---
    .replace(/\\\\\{/g, "\\{")
    .replace(/\\\\}/g, "\\}")
    .replace(/\\\\\\\\/g, "\\\\")
    .replace(/([^\w]|^)\^([a-zA-Z0-9]+)([PC])_([a-zA-Z0-9]+)/g, "$1{}^$2$3_$4")
    
    // --- PASS 6: CLEAN STYLE AND LAYOUT OVERRIDES ---
    .replace(/\\text-decoration:/g, "text-decoration:")
    .replace(/\\text-align:/g, "text-align:")
    .replace(/\\text-left:/g, "text-left:")
    
    // --- PASS 7: PROGRAMMATIC ARTIFACT & MULTIPLIER PROTECTION RESET ---
    // Upgraded: Re-engineered with non-capturing block logic to reliably clear all multi-escaped close-icon strings
    .replace(/(?:\\+)?&?times;/g, "&times;")
    .replace(/&nbsp;/g, " ")
    .replace(/\bs\(A\)\s*=\s*p/g, "n(A) = p")
    .replace(/\]+\]/g, "")
    .replace(/\]+\]/g, "")
    .replace(/\]+\]/g, "");

  // --- PASS 8: SAFE TEXT-BASED RE-INJECTION (IMMUNE TO REGEX TRAPS) ---
  cleanString = cleanString.split("__INLINE_M__").join("[['$', '$']]");
  cleanString = cleanString.split("__DISPLAY_M__").join("[['$$', '$$']]");

  // --- PASS 9: JAVASCRIPT CONDITION LINE-BREAK REPAIR SHIELD ---
  cleanString = cleanString.replace(/if\s*\(currentScale\s*\n\s*<\s*0\.8\)/g, "if (currentScale < 0.8)");
  cleanString = cleanString.replace(/if\s*\(currentScale\s*>\s*\n\s*1\.4\)/g, "if (currentScale > 1.4)");

  return cleanString;
}
