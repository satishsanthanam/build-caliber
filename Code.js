// =====================================================================
// 🔮 THE ALCHEMIST CORE: MASTER PRODUCTION ENGINE (V7.6 - FORTIFIED)
// =====================================================================

let logBuffer = [];

function log(msg) {
  Logger.log(msg);
  logBuffer.push(new Date().toLocaleTimeString() + " - " + msg);
}

/**
 * MAIN EXECUTION ENGINE
 * Orchestrates Sheet reading, Native Drive PDF fetching, Gemini processing, and Bitbucket pushes.
 */
function runAlchemistAutomatedFactory() {
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
    path: headers.indexOf("Bitbucket Path (Auto)")
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
    log("👉 Please verify your sheet columns match exactly: 'Subject', 'Class Level', 'Chapter No.', 'Chapter Title', 'Drive Link', 'Status', 'Bitbucket Path (Auto)'");
    flushLogsToDrive();
    return;
  }

  let taskQueue = [];
  let sessionConversions = 0;
  let sessionFailed = 0;

  for (let r = 1; r < data.length; r++) {
    const currentStatus = data[r][colIndex.status].toString().trim();
    if (currentStatus.includes("Pending")) {
      taskQueue.push({ rowNum: r + 1, data: data[r] });
    }
  }

  const totalInput = taskQueue.length;
  log("📊 Spreadsheet Scan Complete. Found " + totalInput + " chapters queued for compilation.");

  if (taskQueue.length === 0) {
    log("🎉 All assets verified green. No 'Pending' rows found. Factory pipeline standing down.");
    flushLogsToDrive();
    return;
  }

  // Read prompt template
  let promptTemplate = "";
  try {
    promptTemplate = HtmlService.createHtmlOutputFromFile("Prompt").getContent();
  } catch (err) {
    log("静态 Prompt Template asset not found. Using safe layout strings.");
    promptTemplate = "Format the output cleanly inside structured HTML divs.";
  }

  // Process Execution Loop
  for (let t = 0; t < taskQueue.length; t++) {
    const task = taskQueue[t];
    const subject = task.data[colIndex.subject].toString().trim().toLowerCase();
    const classLevel = task.data[colIndex.classLevel].toString().trim();
    const chapterNo = parseInt(task.data[colIndex.chapterNo], 10);
    const chapterTitle = task.data[colIndex.title].toString().trim();

    log("=========================================");
    log("🌐 Row [" + task.rowNum + "] Processing: Chapter " + chapterNo + " - " + chapterTitle + " (" + classLevel + ")");

    const driveUrl = task.data[colIndex.driveLink].toString().trim();
    let pdfBlob = null;

    if (!driveUrl || !driveUrl.includes("drive.google.com")) {
      log("❌ STORAGE FAULT: Missing or invalid Google Drive URL in row " + task.rowNum);
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("❌ MISSING LINK");
      sessionFailed++;
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
      sessionFailed++;
      flushLogsToDrive();
      continue;
    }

    let cleanHtmlPayload = "";
    try {
      const optimalModel = "gemini-3.1-pro-preview";
      let apiResponseRaw = callGeminiAPI(pdfBlob, promptTemplate, optimalModel, GEMINI_API_KEY);
      
      // Validate response is not empty before parsing
      if (!apiResponseRaw || apiResponseRaw.trim().length === 0) {
        throw new Error("API returned empty response");
      }
      
      // Attempt to parse JSON
      let parsedJson = JSON.parse(apiResponseRaw);
      cleanHtmlPayload = parsedJson.html_content;
      
      if (!cleanHtmlPayload) throw new Error("html_content string parsed empty.");
    } catch (parseError) {
      log("❌ PARSE FAULT: AI structure truncated. Error: " + parseError.toString());
      log("🔍 DEBUG: Response length was " + (apiResponseRaw ? apiResponseRaw.length : 0) + " characters");
      if (apiResponseRaw && apiResponseRaw.length < 500) {
        log("🔍 DEBUG: Raw response: " + apiResponseRaw);
      }
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("⚠️ Output Truncated");
      sessionFailed++;
      continue;
    }

    // 🧮 MATHJAX INJECTION
    let completeWebPageContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${chapterTitle}</title>
  <link rel="stylesheet" href="../../style.css">
  <style>
    body { margin: 0; padding: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .chapter-container { max-width: 900px; margin: 0 auto; }
    img { max-width: 100%; height: auto; }
    table { width: 100%; border-collapse: collapse; overflow-x: auto; }
    table, th, td { border: 1px solid #ddd; padding: 8px; }
    @media (max-width: 768px) {
      body { padding: 8px; font-size: 14px; }
      .chapter-container { padding: 0; }
      table { font-size: 12px; }
      table, th, td { padding: 6px; }
    }
  </style>
  <script>
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$']],
        displayMath: [['$$', '$$']]
      }
    };
  </script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
</head>
<body>
  <div class="chapter-container">
    ${cleanHtmlPayload}
  </div>
</body>
</html>`;

    const sanitizedSubject = subject.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const sanitizedClass = classLevel.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const sanitizedTitle = chapterTitle.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    const finalPath = sanitizedSubject + "/" + sanitizedClass + "/" + sanitizedTitle + ".html";

    const stagingBranchName = "factory-builds";
    const commitSuccess = pushFileToBitbucketWithJira(finalPath, completeWebPageContent, stagingBranchName);

    if (commitSuccess) {
      const prStatus = raiseBitbucketPullRequest(stagingBranchName, finalPath);
      if (prStatus) {
        log("🚀 PIPELINE SUCCESS: File safely deployed -> " + finalPath);
        appendToCompletedLog(finalPath);
        sessionConversions++;

        sheet.getRange(task.rowNum, colIndex.status + 1).setValue("✅ Completed");
        sheet.getRange(task.rowNum, colIndex.path + 1).setValue(finalPath);
      } else {
        sheet.getRange(task.rowNum, colIndex.status + 1).setValue("❌ PR Gen Fault");
        sessionFailed++;
      }
    } else {
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("❌ Deploy Fault");
      sessionFailed++;
    }

    SpreadsheetApp.flush();
    flushLogsToDrive();
    Utilities.sleep(4000);
  }

  // 📊 SESSION SUMMARY
  log("=========================================");
  log("📊 SESSION SUMMARY - Current Run");
  log("=========================================");
  log("📥 Total Input: " + totalInput);
  log("✅ Total Completed: " + sessionConversions);
  log("❌ Total Failed: " + sessionFailed);
  log("=========================================");

  flushLogsToDrive();

  // 🔨 BUILD INDEX FROM COMPLETED CHAPTERS
  log("🏗️ Triggering Dynamic Index Builder v2...");
  buildDynamicIndexv2();
}

/**
 * Connects directly to Google AI Studio Gemini API endpoints
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
        "properties": { "html_content": { "type": "STRING" } },
        "required": ["html_content"]
      },
      "temperature": 0.2,
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
    throw new Error(json.error ? json.error.message : "API Error: " + response.getResponseCode());
  }
  
  // Extract text and validate it's valid JSON
  let textContent = json.candidates[0].content.parts[0].text;
  
  // Ensure response is valid JSON - try parsing to catch truncation issues early
  try {
    JSON.parse(textContent);
  } catch (e) {
    // If parsing fails, log and throw with details
    throw new Error("Gemini response is not valid JSON: " + e.message + " (response length: " + textContent.length + ")");
  }
  
  return textContent;
}

/**
 * Git Multi-part File Deployer
 */
function pushFileToBitbucketWithJira(filePath, fileContent, branchName) {
  const props = PropertiesService.getScriptProperties();
  const username = props.getProperty("BITBUCKET_USER");
  const appPassword = props.getProperty("BITBUCKET_APP_PASSWORD");
  const workspace = props.getProperty("BITBUCKET_WORKSPACE");
  const repoSlug = props.getProperty("BITBUCKET_REPO_SLUG");
  const jiraTicket = props.getProperty("JIRA_TICKET_ID") || "ALC-SYNC";

  if (!username || !appPassword || !workspace || !repoSlug) return false;

  const url = "https://api.bitbucket.org/2.0/repositories/" + workspace + "/" + repoSlug + "/src";
  const boundary = "zzXXzzYYzzFFF";
  const payload =
    "--" + boundary + "\r\n" +
    "Content-Disposition: form-data; name=\"message\"\r\n\r\n" +
    "[" + jiraTicket + "] sync: compiled " + filePath + "\r\n" +
    "--" + boundary + "\r\n" +
    "Content-Disposition: form-data; name=\"branch\"\r\n\r\n" +
    branchName + "\r\n" +
    "--" + boundary + "\r\n" +
    "Content-Disposition: form-data; name=\"" + filePath + "\"\r\n\r\n" +
    fileContent + "\r\n" +
    "--" + boundary + "--\r\n";

  const options = {
    "method": "post",
    "contentType": "multipart/form-data; boundary=" + boundary,
    "headers": { "Authorization": "Basic " + Utilities.base64Encode(username + ":" + appPassword) },
    "payload": Utilities.newBlob(payload).getBytes(),
    "muteHttpExceptions": true
  };
  const res = UrlFetchApp.fetch(url, options);
  return res.getResponseCode() === 201 || res.getResponseCode() === 200;
}

function raiseBitbucketPullRequest(branchName, filePath) {
  const props = PropertiesService.getScriptProperties();
  const username = props.getProperty("BITBUCKET_USER");
  const appPassword = props.getProperty("BITBUCKET_APP_PASSWORD");
  const workspace = props.getProperty("BITBUCKET_WORKSPACE");
  const repoSlug = props.getProperty("BITBUCKET_REPO_SLUG");

  const url = "https://api.bitbucket.org/2.0/repositories/" + workspace + "/" + repoSlug + "/pullrequests";
  const prPayload = {
    "title": "🔮 [Build Calibre] Merge Staging to Main",
    "description": "Unified pipeline curriculum compilation staging.",
    "source": { "branch": { "name": branchName } },
    "destination": { "branch": { "name": "main" } },
    "close_source_branch": true
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "headers": { "Authorization": "Basic " + Utilities.base64Encode(username + ":" + appPassword) },
    "payload": JSON.stringify(prPayload),
    "muteHttpExceptions": true
  };
  const res = UrlFetchApp.fetch(url, options);
  return res.getResponseCode() === 201 || res.getResponseCode() === 200 || res.getResponseCode() === 409;
}

function appendToCompletedLog(bitbucketPath) {
  try {
    const folderId = PropertiesService.getScriptProperties().getProperty("OUTPUT_FOLDER_ID");
    if (!folderId) return;
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByName("completed.txt");
    let file = files.hasNext() ? files.next() : folder.createFile("completed.txt", "", MimeType.PLAIN_TEXT);
    const cur = file.getBlob().getDataAsString();
    file.setContent(cur ? cur + "\n" + bitbucketPath : bitbucketPath);
  } catch (e) {}
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
  } catch (e) {}
}

// =====================================================================
// 🌐 SYNCHRONIZERS & UTILITIES
// =====================================================================

/**
 * DYNAMIC COLLAPSIBLE NAVIGATION BUILDING ENGINE (v3 - DIAGNOSTIC OVERRIDE)
 */
function buildDynamicIndexv3() {
  Logger.log("🏁 Index Engine v3 Ignition: Scanning for completed content...");
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

  // 🛡️ INDEX GUARD BLOCK
  for (const [key, idx] of Object.entries(col)) {
    if (idx === -1) {
      Logger.log("❌ CRITICAL INDEX FAULT: Header column matching '" + key + "' was not found in the spreadsheet row.");
      return;
    }
  }

  const curriculumMap = {};
  let completedCount = 0;

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const currentStatus = row[col.status].toString().trim();
    
    if (currentStatus === "✅ Completed") {
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

  Logger.log("📊 Index scan found " + completedCount + " successfully verified chapters.");

  if (completedCount === 0) {
    Logger.log("⚠️ WARNING: 0 verified '✅ Completed' chapters detected. Halting push to prevent blanking the home file.");
    return;
  }

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="style.css">
  <title>Build Calibre - Curriculum Home</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 15px; }
    .clean-list { list-style-type: none; padding-left: 10px; border-left: 2px solid #eee; margin-left: 10px; margin-bottom: 10px; }
    .keyword a { color: #0056b3; text-decoration: none; font-size: 1.05em; word-break: break-word; }
    .keyword a:hover { text-decoration: underline; color: #003d82; }
    .chapter-row { margin-bottom: 12px; word-break: break-word; }
    .topic-box { margin-bottom: 15px; border: 1px solid #ddd; padding: 12px; border-radius: 8px; background-color: #fafafa; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    
    .topic-title, .class-title { 
      display: block !important;
      position: relative !important; 
      padding: 8px 10px 8px 45px !important;
      cursor: pointer;
      box-sizing: border-box;
      outline: none !important;
      list-style: none !important;
      word-break: break-word;
    }
    
    .topic-title { font-size: 1.2em; font-weight: bold; color: #2c3e50; }
    .class-title { font-size: 1em; font-weight: 600; color: #34495e; margin-top: 10px; }
    
    summary::-webkit-details-marker { display: none !important; }
    summary::marker { display: none !important; content: "" !important; }
    summary:hover { color: #0056b3; }
    
    .topic-title::before, .class-title::before { 
      content: '[+]' !important; 
      position: absolute !important; 
      left: 8px !important; 
      top: 50% !important;
      transform: translateY(-50%) !important;
      font-weight: bold !important; 
      color: #0056b3 !important;
      font-size: 1em !important; 
      font-family: monospace !important;
    }
    details[open] > .topic-title::before,
    details[open] > .class-title::before { 
      content: '[-]' !important; 
      color: #e67e22 !important;
    }
    .nav-bar h2 { margin: 0 0 20px 0; font-size: 1.5em; }
    
    @media (max-width: 768px) {
      body { padding: 10px; font-size: 14px; }
      .topic-box { padding: 10px; margin-bottom: 10px; }
      .topic-title { font-size: 1.1em; }
      .class-title { font-size: 0.95em; }
      .topic-title::before, .class-title::before { left: 6px; }
      .nav-bar h2 { font-size: 1.3em; margin-bottom: 15px; }
      .chapter-row { margin-bottom: 10px; font-size: 13px; }
    }
    
    @media (max-width: 480px) {
      body { padding: 8px; }
      .topic-title { font-size: 1em; padding: 6px 10px 6px 40px !important; }
      .class-title { font-size: 0.9em; padding: 6px 10px 6px 40px !important; }
      .keyword a { font-size: 1em; }
      .nav-bar h2 { font-size: 1.1em; }
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
    Logger.log("✅ SUCCESS: Immaculate index layout compiled and pushed via v3!");
  }
}