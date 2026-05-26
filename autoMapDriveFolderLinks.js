// =====================================================================
// 🔮 THE BUILD CALIBRE CORE: MASTER PRODUCTION ENGINE (V8.7 - MULTI-FAILOVER)
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

  if (!INVENTORY_SHEET_ID || !OUTPUT_FOLDER_ID) {
    log("❌ CRITICAL ERROR: Core folder or sheet script configurations missing. Exiting.");
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

  let missingHeaders = [];
  for (const [key, idx] of Object.entries(colIndex)) {
    if (idx === -1) {
      missingHeaders.push(key);
    }
  }
  if (missingHeaders.length > 0) {
    log("❌ CRITICAL SHEET FAULT: Missing or misspelled headers: " + JSON.stringify(missingHeaders));
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
    log("🎉 All assets verified green. No 'Pending' rows found.");
    flushLogsToDrive();
    return;
  }

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
      let apiResponseRaw = callGeminiAPIWithFailover(pdfBlob, promptTemplate, optimalModel);
      parsedJson = JSON.parse(apiResponseRaw);
      
      if (!parsedJson.html_content || !parsedJson.output_filename) {
        throw new Error("Crucial JSON fields returned empty from the model.");
      }
    } catch (parseError) {
      log("❌ PARSE FAULT: AI execution stalled or truncated. Error: " + parseError.toString());
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("⚠️ Output Truncated");
      continue;
    }

    // 📄 BASE HTML PAGE ASSEMBLY (Unbreakable layout uniformity with global title headings)
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

    // 🛡️ APPS SCRIPT DEFENSIVE SANITIZATION LAYER FOR FILE PATHS
    let computedFileName = parsedJson.output_filename.trim();
    if (computedFileName.endsWith(".html")) {
      computedFileName = computedFileName.substring(0, computedFileName.length - 5);
    }
    
    if (computedFileName.length > 48) {
      computedFileName = computedFileName.substring(0, 48);
      if (computedFileName.endsWith("-")) {
        computedFileName = computedFileName.substring(0, computedFileName.length - 1);
      }
    }
    computedFileName = computedFileName + ".html";

    const sanitizedSubject = subject.toLowerCase().replace(/[^a-z0-9]/g, "-");
    let sanitizedClass = "class-" + parseInt(classLevel.replace(/[^0-9]/g, ""), 10);
    
    // Support multi-book structures (e.g., class-8-1, class-8-2) natively via folder routing
    const partDigits = classLevel.match(/(?:part|volume|term)[-_\s]*(\d+)/i) || classLevel.match(/class[-_\s]*\d+[-_\s]*(\d+)/i);
    if (partDigits) {
      sanitizedClass = sanitizedClass + "-" + partDigits[1];
    }
    
    const finalPath = sanitizedSubject + "/" + sanitizedClass + "/" + computedFileName;
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
    Utilities.sleep(4000);
  }
  flushLogsToDrive();
}

/**
 * MULTI-ACCOUNT INTELLIGENT FAILOVER ROUTER
 * Iterates sequentially through available Free Tier API keys across accounts.
 * Switches to the Paid Production Key only when free allocations return 429 errors.
 */
function callGeminiAPIWithFailover(pdfBlob, promptText, modelName) {
  const props = PropertiesService.getScriptProperties();
  
  // Scans for your individual multi-account key metrics
  const freeKeys = [
    props.getProperty("GEMINI_FREE_KEY_ACCOUNT_A"),
    props.getProperty("GEMINI_FREE_KEY_ACCOUNT_B")
  ].filter(Boolean);

  const PAID_KEY = props.getProperty("GEMINI_PAID_KEY");

  if (freeKeys.length === 0 && !PAID_KEY) {
    throw new Error("CRITICAL CREDENTIAL FAULT: No valid API keys found in Script Properties configurations.");
  }

  // 🔄 LOOP THROUGH FREE KEYS FIRST
  for (let i = 0; i < freeKeys.length; i++) {
    try {
      log("🔌 Routing pipeline load to Free Key Array Slot [" + (i + 1) + "]...");
      return executeNetworkFetch(pdfBlob, promptText, modelName, freeKeys[i]);
    } catch (apiError) {
      const errorMsg = apiError.toString();
      
      if (errorMsg.includes("429")) {
        log("⚠️ Free Key Slot [" + (i + 1) + "] quota exhausted. Advancing array index...");
        continue; // Advance to evaluate next free account asset slot
      }
      
      log("❌ STRUCTURAL API FAULT: " + errorMsg);
      throw apiError; // Halt immediately on structural formatting syntax syntax issues
    }
  }

  // 💳 FINAL PAID TIER FALLBACK RESCUE LINE
  if (PAID_KEY) {
    log("🚨 All Free Tier allocations exhausted for the day. Swapping to Pay-As-You-Go Tier...");
    try {
      return executeNetworkFetch(pdfBlob, promptText, modelName, PAID_KEY);
    } catch (paidError) {
      log("❌ CRITICAL PAID TIER FAILURE: " + paidError.toString());
      throw paidError;
    }
  }

  throw new Error("❌ PIPELINE HALTED: Every available Free Tier key has been completely exhausted, and no Backup Paid Key is configured.");
}

/**
 * Raw HTTP Network Post Wrapper
 */
function executeNetworkFetch(pdfBlob, promptText, modelName, apiKey) {
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
    throw new Error("HTTP " + response.getResponseCode() + ": " + (json.error ? json.error.message : "Unknown Error"));
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

function autoMapDriveFolderLinks() {
  Logger.log("🏁 Starting automated spreadsheet path mapping alignment...");
  const props = PropertiesService.getScriptProperties();
  const INVENTORY_SHEET_ID = props.getProperty("INVENTORY_SHEET_ID");
  if (!INVENTORY_SHEET_ID) return;

  const sheet = SpreadsheetApp.openById(INVENTORY_SHEET_ID).getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const col = {
    subject: headers.indexOf("Subject"),
    classLevel: headers.indexOf("Class Level"),
    chapterNo: headers.indexOf("Chapter No."),
    title: headers.indexOf("Chapter Title"),
    path: headers.indexOf("Bitbucket Path (Auto)")
  };

  if (col.subject === -1 || col.classLevel === -1 || col.chapterNo === -1 || col.title === -1 || col.path === -1) return;

  let updateCount = 0;
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const subjectRaw = row[col.subject].toString().trim();
    const classRaw = row[col.classLevel].toString().trim();
    const chapRaw = row[col.chapterNo].toString().trim();
    const titleRaw = row[col.title].toString().trim();

    if (!subjectRaw || !classRaw || !titleRaw) continue;

    let mm = "00";
    const classDigits = classRaw.match(/\d+/);
    if (classDigits) {
      mm = parseInt(classDigits[0], 10).toString();
      if (mm.length < 2) mm = "0" + mm;
    }

    let nn = "00";
    const chapDigits = chapRaw.match(/\d+/);
    if (chapDigits) {
      nn = parseInt(chapDigits[0], 10).toString();
      if (nn.length < 2) nn = "0" + nn;
    }

    let topicSlug = titleRaw.toLowerCase().replace(/[^a-z0-9\s-_]/g, "").replace(/[\s-_]+/g, "-").trim();
    if (topicSlug.startsWith("-")) topicSlug = topicSlug.substring(1);
    if (topicSlug.endsWith("-")) topicSlug = topicSlug.substring(0, topicSlug.length - 1);

    const subjectSubfolder = subjectRaw.toLowerCase().replace(/[^a-z0-9]/g, "-");
    let classSubfolder = "class-" + parseInt(mm, 10);
    const partDigits = classRaw.match(/(?:part|volume|term)[-_\s]*(\d+)/i) || classRaw.match(/class[-_\s]*\d+[-_\s]*(\d+)/i);
    if (partDigits) {
      classSubfolder = classSubfolder + "-" + partDigits[1];
    }

    let truncatedSlug = topicSlug.substring(0, 34);
    if (truncatedSlug.endsWith("-")) truncatedSlug = truncatedSlug.substring(0, truncatedSlug.length - 1);

    const computedFileName = mm + "-chapter-" + nn + "-" + truncatedSlug + ".html";
    const deterministicPath = subjectSubfolder + "/" + classSubfolder + "/" + computedFileName;

    if (row[col.path].toString().trim() !== deterministicPath) {
      sheet.getRange(r + 1, col.path + 1).setValue(deterministicPath);
      updateCount++;
    }
  }
  Logger.log("✅ COMPLETED: Path configuration sync run finalized. Updated " + updateCount + " file mappings.");
}