// =====================================================================
// 🔮 THE BUILD CALIBRE CORE: MASTER PRODUCTION ENGINE (V11.0 - FULLY HARMONIZED)
// =====================================================================

let logBuffer = [];
function log(msg) {
  Logger.log(msg);
  logBuffer.push(new Date().toLocaleTimeString() + " - " + msg);
}

/**
 * MAIN EXECUTION ENGINE
 * Orchestrates Sheet reading, Native Drive PDF fetching, Gemini processing, and GitHub pushes.
 * Features bi-directional dynamic sequence mapping and bulletproof path sanitization.
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

  // 🛡️ FACTORY GUARD BLOCK: Prevents undefined crashes if columns are shifted or renamed
  let missingHeaders = [];
  for (const [key, idx] of Object.entries(colIndex)) {
    if (idx === -1) {
      missingHeaders.push(key);
    }
  }
  if (missingHeaders.length > 0) {
    log("❌ CRITICAL SHEET FAULT: The following headers are missing or misspelled in your spreadsheet: " + JSON.stringify(missingHeaders));
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

  // Read prompt template (Loads your Coach-enriched msprompt content from your local Prompt.html file)
  let promptTemplate = "";
  try {
    promptTemplate = HtmlService.createHtmlOutputFromFile("Prompt").getContent();
  } catch (err) {
    log("❌ CRITICAL ASSET FAULT: Prompt.html file containing your enriched instructions was not found.");
    flushLogsToDrive();
    return;
  }

  // Process Execution Loop
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
          if (attempts > 1) {
            Logger.log(`🎉 RETRY SUCCESS: Pass #${attempts} resolved cleanly. Response Length: ${rawResponse.length} chars.`);
          }
          break;
        } catch (jsonError) {
          Logger.log(`⚠️ PARSE FAULT: Attempt #${attempts} failed to parse.`);
          Logger.log(`📊 Metrics: Total Character Length received: ${rawResponse ? rawResponse.length : 0}`);
          if (rawResponse) {
            const tailSnapshot = rawResponse.length > 150 ? "..." + rawResponse.substring(rawResponse.length - 150) : rawResponse;
            Logger.log(`🔍 Raw Tail Snapshot:\n${tailSnapshot}`);
          }
          if (attempts >= maxAttempts) {
            Logger.log(`❌ CRITICAL PIPELINE FAILURE: Maximum retry threshold reached for this file.`);
            throw jsonError;
          }
          Logger.log(`🔄 Retrying pipeline pass... [Attempt ${attempts + 1}/${maxAttempts}]`);
          Utilities.sleep(2000);
        }
      }

      if (!parsedJson || !parsedJson.html_content || !parsedJson.output_filename) {
        throw new Error("Crucial JSON fields returned empty from the model.");
      }
    } catch (parseError) {
      log("❌ PARSE FAULT: AI execution stalled or truncated. Error: " + parseError.toString());
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("⚠️ Output Truncated");
      continue;
    }

    // =====================================================================
    // 🛡️ APPS SCRIPT DEFENSIVE SANITIZATION LAYER FOR FILE PATHS
    // =====================================================================
    let baseClassNum = parseInt(classLevel.replace(/[^0-9]/g, ""), 10);
    let sanitizedClass = "class-" + baseClassNum;

    const partDigits = classLevel.match(/(?:part|volume|term)[-_\s]*(\d+)/i) || classLevel.match(/class[-_\s]*\d+[-_\s]*(\d+)/i);
    if (partDigits) {
      sanitizedClass = sanitizedClass + "-" + partDigits[1];
    }

    // 🛡️ BULLETPROOF ZERO-PADDING ENGINE (Bypasses engine compatibility & float bugs)
    let cleanClassNum = parseInt(baseClassNum, 10);
    let cleanChapNum = parseInt(chapterNo, 10);
    const mmStr = !isNaN(cleanClassNum) ? ("0" + cleanClassNum).slice(-2) : "00";
    const nnStr = chapterNo !== "999" && !isNaN(cleanChapNum) ? ("0" + cleanChapNum).slice(-2) : "00";
    
    let topicSlug = chapterTitle.toLowerCase().replace(/[^a-z0-9\s-_]/g, "").replace(/[\s-_]+/g, "-").trim();
    if (topicSlug.startsWith("-")) topicSlug = topicSlug.substring(1);
    if (topicSlug.endsWith("-")) topicSlug = topicSlug.substring(0, topicSlug.length - 1);

    let truncatedSlug = topicSlug.substring(0, 34);
    if (truncatedSlug.endsWith("-")) {
      truncatedSlug = truncatedSlug.substring(0, truncatedSlug.length - 1);
    }

    const computedFileName = mmStr + "-chapter-" + nnStr + "-" + truncatedSlug + ".html";
    const sanitizedSubject = subject.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const finalPath = sanitizedSubject + "/" + sanitizedClass + "/" + computedFileName;

    // =====================================================================
    // 🔍 DUAL-DIRECTION BI-DIRECTIONAL SEQUENCE SCANNER
    // =====================================================================
    let cleanDisplayChapter = parseInt(chapterNo, 10);
    let prevFileName = "../../index.html"; // Default fallback if Chapter 1
    let nextFileName = "../../index.html"; // Default fallback if last chapter
    
    let prevTargetChap = cleanDisplayChapter - 1;
    let nextTargetChap = cleanDisplayChapter + 1;

    for (let checkR = 1; checkR < data.length; checkR++) {
      let checkSub = data[checkR][colIndex.subject].toString().trim();
      let checkClass = data[checkR][colIndex.classLevel].toString().trim();
      let checkChap = parseInt(data[checkR][colIndex.chapterNo], 10);

      if (checkSub === subject && checkClass === classLevel) {
        
        // ⏪ Look-Behind Dynamic Filename Predictor
        if (checkChap === prevTargetChap) {
          let prevTitle = data[checkR][colIndex.title].toString().trim();
          let prevSlug = prevTitle.toLowerCase().replace(/[^a-z0-9\s-_]/g, "").replace(/[\s-_]+/g, "-").trim();
          if (prevSlug.startsWith("-")) prevSlug = prevSlug.substring(1);
          if (prevSlug.endsWith("-")) prevSlug = prevSlug.substring(0, prevSlug.length - 1);
          
          let prevTruncated = prevSlug.substring(0, 34);
          if (prevTruncated.endsWith("-")) prevTruncated = prevTruncated.substring(0, prevTruncated.length - 1);
          
          prevFileName = mmStr + "-chapter-" + ("0" + prevTargetChap).slice(-2) + "-" + prevTruncated + ".html";
        }

        // ⏩ Look-Ahead Dynamic Filename Predictor
        if (checkChap === nextTargetChap) {
          let nextTitle = data[checkR][colIndex.title].toString().trim();
          let nextSlug = nextTitle.toLowerCase().replace(/[^a-z0-9\s-_]/g, "").replace(/[\s-_]+/g, "-").trim();
          if (nextSlug.startsWith("-")) nextSlug = nextSlug.substring(1);
          if (nextSlug.endsWith("-")) nextSlug = nextSlug.substring(0, nextSlug.length - 1);
          
          let nextTruncated = nextSlug.substring(0, 34);
          if (nextTruncated.endsWith("-")) nextTruncated = nextTruncated.substring(0, nextTruncated.length - 1);
          
          nextFileName = mmStr + "-chapter-" + ("0" + nextTargetChap).slice(-2) + "-" + nextTruncated + ".html";
        }
      }
    }

    // =====================================================================
    // 🧭 STANDARDIZED SEARCH HEADING & ACCESSIBILITY MODAL TEMPLATE
    // =====================================================================
    let masterSearchHeaderTitle = `Class ${baseClassNum} — Chapter ${cleanDisplayChapter}: ${parsedJson.extracted_chapter_title || chapterTitle}`;

    let completeWebPageContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${masterSearchHeaderTitle}</title>
  <link rel="stylesheet" href="../../style.css">
  <style>
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 9999;
      justify-content: center;
      align-items: center;
    }
    .modal-overlay.active { display: flex; }
    .modal-content {
      background: #ffffff;
      padding: 24px;
      border-radius: 12px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
      position: relative;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .close-modal {
      position: absolute;
      top: 12px; right: 16px;
      font-size: 28px; font-weight: bold; color: #666;
      cursor: pointer;
    }
    .close-modal:hover { color: #000; }
    .modal-title { margin-top: 0; color: #111; font-size: 1.3rem; display: flex; align-items: center; gap: 8px; }
    .modal-desc { color: #555; font-size: 0.95rem; line-height: 1.4; margin-bottom: 20px; }
    .modal-grid { display: flex; flex-direction: column; gap: 10px; }
    .modal-btn {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 12px; background: #f0f4f8; color: #1a202c;
      text-decoration: none; border-radius: 6px; font-weight: 500;
      border: 1px solid #cbd5e1; transition: all 0.2s ease; cursor: pointer;
    }
    .modal-btn:hover { background: #e2e8f0; border-color: #94a3b8; }
    .modal-btn.primary { background: #3182ce; color: white; border: none; }
    .modal-btn.primary:hover { background: #2b6cb0; }
    .accessibility-ctrl {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;
    }
    .btn-scale { padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 4px; background: white; cursor: pointer; }
    .btn-scale:hover { background: #f7fafc; }
  </style>
  <script>
    window.MathJax = {
      tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']] },
      chtml: { displayAlign: 'left', displayIndent: '1em' }
    };
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
    function toggleModal(show) {
      const modal = document.getElementById('navModal');
      if (show) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      } else {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    }

    function navigateChapterSequence(direction) {
      toggleModal(false); // Force instant visual collapse on execution
      if (direction === -1) {
        window.location.href = "${prevFileName}";
      } else {
        window.location.href = "${nextFileName}";
      }
    }

    let currentScale = 1.0;
    function adjustTextSize(delta) {
      currentScale += delta;
      if (currentScale < 0.8) currentScale = 0.8;
      if (currentScale > 1.4) currentScale = 1.4;
      document.querySelector('.chapter-container').style.fontSize = currentScale + 'em';
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') toggleModal(false);
    });
  </script>
</body>
</html>`;

    // 🚀 ROUTE ASSETS TO GITHUB STAGING ENVIRONMENT
    const stagingBranchName = "develop"; 
    const commitSuccess = pushFileToGitHub(finalPath, completeWebPageContent, stagingBranchName);

    if (commitSuccess) {
      log("🚀 PIPELINE SUCCESS: File safely deployed directly to GitHub staging -> " + finalPath);
      appendToCompletedLog(finalPath, parsedJson.index_update);
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("✅ Completed");
      sheet.getRange(task.rowNum, colIndex.path + 1).setValue(finalPath);
    } else {
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("❌ GitHub Deploy Fault");
    }

    SpreadsheetApp.flush();
    flushLogsToDrive();
    Utilities.sleep(4000);
  }
  flushLogsToDrive();
}

/**
 * CONNECTS DIRECTLY TO GOOGLE AI STUDIO ENDPOINTS
 */
function callGeminiAPI(pdfBlob, promptText, modelName, apiKey) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":generateContent?key=" + apiKey;
  const payload = {
    "contents": [{
      "parts": [
        { "inlineData": { "mimeType": "application/pdf", "data": Utilities.base64Encode(pdfBlob.getBytes()) } },
        { "text": promptText }
      ]
    }],
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
      "maxOutputTokens": 8192
    }
  };
  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());

  if (response.getResponseCode() !== 200) {
    throw new Error("HTTP " + response.getResponseCode() + ": " + (json.error ? json.error.message : "Unknown API Exception"));
  }
  return json.candidates[0].content.parts[0].text;
}

/**
 * PUSHES RAW COMPILED ASSETS DIRECTLY TO GITHUB REPOSITORY VIA CONTENTS API
 * Handles file creations and updates gracefully by pre-fetching system file signatures (SHAs).
 */
function pushFileToGitHub(filePath, fileContent, branchName) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("GITHUB_PAT");         
  const username = props.getProperty("GITHUB_USERNAME");   
  const repo = props.getProperty("GITHUB_REPO");         
  
  if (!token || !username || !repo) {
    Logger.log("⚠️ GITHUB CONFIGURATION FAULT: Configuration property definitions are blank.");
    return false;
  }
  
  const url = "https://api.github.com/repos/" + username + "/" + repo + "/contents/" + filePath;
  
  // Phase 1: Scan for pre-existing system signatures to manage updates seamlessly
  let fileSha = null;
  const checkOptions = {
    "method": "get",
    "headers": {
      "Authorization": "token " + token,
      "Accept": "application/vnd.github.v3+json"
    },
    "muteHttpExceptions": true
  };
  
  const checkResponse = UrlFetchApp.fetch(url, checkOptions);
  if (checkResponse.getResponseCode() === 200) {
    const existingFileMetadata = JSON.parse(checkResponse.getContentText());
    fileSha = existingFileMetadata.sha;
  }
  
  // Phase 2: Frame the commit payload configurations
  const commitPayload = {
    "message": "pipeline automation: compile layout structure for " + filePath,
    "content": Utilities.base64Encode(Utilities.newBlob(fileContent).getBytes()),
    "branch": branchName
  };
  
  if (fileSha) {
    commitPayload["sha"] = fileSha; 
  }
  
  const pushOptions = {
    "method": "put",
    "contentType": "application/json",
    "headers": {
      "Authorization": "token " + token,
      "Accept": "application/vnd.github.v3+json"
    },
    "payload": JSON.stringify(commitPayload),
    "muteHttpExceptions": true
  };
  
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
    if (indexSnippet) {
      logEntry += "\nSnippet:\n" + indexSnippet + "\n--------------------";
    }

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