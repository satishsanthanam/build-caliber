// =====================================================================
// 🔮 THE BUILD CALIBRE CORE: MASTER PRODUCTION ENGINE (V9.6 - FINAL HARMONIZED)
// =====================================================================

let logBuffer = [];

function log(msg) {
  Logger.log(msg);
  logBuffer.push(new Date().toLocaleTimeString() + " - " + msg);
}

/**
 * MAIN EXECUTION ENGINE
 * Orchestrates Sheet reading, Native Drive PDF fetching, Gemini processing, and Bitbucket pushes.
 * Compliant single-key implementation featuring absolute filesystem path alignment.
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
      let apiResponseRaw = callGeminiAPI(pdfBlob, promptTemplate, optimalModel, GEMINI_API_KEY);
      parsedJson = JSON.parse(apiResponseRaw);
      
      if (!parsedJson.html_content || !parsedJson.output_filename) {
        throw new Error("Crucial JSON fields returned empty from the model.");
      }
    } catch (parseError) {
      log("❌ PARSE FAULT: AI execution stalled or truncated. Error: " + parseError.toString());
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("⚠️ Output Truncated");
      continue;
    }

    // 📄 BASE HTML PAGE ASSEMBLY (Hardcoded navigation controls and uniform global headings)
    let completeWebPageContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${parsedJson.extracted_chapter_title || chapterTitle}</title>
  <link rel="stylesheet" href="../../style.css">
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
    
    <div class="nav-bar">
      <a href="#" onclick="history.back(); return false;" class="btn-nav">← Back</a>
      <a href="../../index.html" class="btn-nav">🏠 Home</a>
    </div>

    <h1>Chapter ${chapterNo}: ${parsedJson.extracted_chapter_title || chapterTitle}</h1>

    ${parsedJson.html_content}

  </div>
</body>
</html>`;

    // =====================================================================
    // 🛡️ APPS SCRIPT DEFENSIVE SANITIZATION LAYER FOR FILE PATHS
    // =====================================================================
    
    // Extract base class index number
    let baseClassNum = parseInt(classLevel.replace(/[^0-9]/g, ""), 10);
    let sanitizedClass = "class-" + baseClassNum;
    
    // Parse Part variables dynamically to match Unix configurations ("class-8-1", "class-8-2")
    const partDigits = classLevel.match(/(?:part|volume|term)[-_\s]*(\d+)/i) || classLevel.match(/class[-_\s]*\d+[-_\s]*(\d+)/i);
    if (partDigits) {
      sanitizedClass = sanitizedClass + "-" + partDigits[1];
    }

    // Formulate zero-padded tracking strings (mm and nn)
    const mmStr = String(baseClassNum).padStart(2, '0');
    const nnStr = chapterNo !== "999" ? String(chapterNo).padStart(2, '0') : '00';

    // Generate topic slug elements
    let topicSlug = chapterTitle.toLowerCase().replace(/[^a-z0-9\s-_]/g, "").replace(/[\s-_]+/g, "-").trim();
    if (topicSlug.startsWith("-")) topicSlug = topicSlug.substring(1);
    if (topicSlug.endsWith("-")) topicSlug = topicSlug.substring(0, topicSlug.length - 1);

    // Strict 48-Character total file length budget check
    // 'mm-chapter-nn-' consumes exactly 14 characters.
    // Allowed budget remaining for the topic text string = 48 - 14 = 34 characters.
    let truncatedSlug = topicSlug.substring(0, 34);
    if (truncatedSlug.endsWith("-")) {
      truncatedSlug = truncatedSlug.substring(0, truncatedSlug.length - 1);
    }

    const computedFileName = mmStr + "-chapter-" + nnStr + "-" + truncatedSlug + ".html";
    const sanitizedSubject = subject.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const finalPath = sanitizedSubject + "/" + sanitizedClass + "/" + computedFileName;

    // Push asset payload to Bitbucket staging repository
    const stagingBranchName = "factory-builds";
    const commitSuccess = pushFileToBitbucketWithJira(finalPath, completeWebPageContent, stagingBranchName);

    if (commitSuccess) {
      const prStatus = raiseBitbucketPullRequest(stagingBranchName, finalPath);
      if (prStatus) {
        log("🚀 PIPELINE SUCCESS: File safely deployed -> " + finalPath);
        appendToCompletedLog(finalPath, parsedJson.index_update);
        sheet.getRange(task.rowNum, colIndex.status + 1).setValue("✅ Completed");
        sheet.getRange(task.rowNum, colIndex.path + 1).setValue(finalPath);
      } else {
        sheet.getRange(task.rowNum, colIndex.status + 1).setValue("❌ PR Gen Fault");
      }
    } else {
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("❌ Deploy Fault");
    }

    SpreadsheetApp.flush();
    flushLogsToDrive();
    Utilities.sleep(4000); // Transaction pacing boundary limits
  }
  flushLogsToDrive();
}

/**
 * CONNECTS DIRECTLY TO GOOGLE AI STUDIO ENDPOINTS
 * Compliant single-credential interface executing content transformations against JSON criteria schemas.
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

function appendToCompletedLog(bitbucketPath, indexSnippet) {
  try {
    const folderId = PropertiesService.getScriptProperties().getProperty("OUTPUT_FOLDER_ID");
    if (!folderId) return;
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFilesByName("completed.txt");
    let file = files.hasNext() ? files.next() : folder.createFile("completed.txt", "", MimeType.PLAIN_TEXT);
    const cur = file.getBlob().getDataAsString();
    
    let logEntry = "File: " + bitbucketPath;
    if (indexSnippet) {
      logEntry += "\nSnippet:\n" + indexSnippet + "\n--------------------";
    }
    
    file.setContent(cur ? cur + "\n" + logEntry : logEntry);
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