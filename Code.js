// =====================================================================
// 🔮 THE ALCHEMIST CORE: MASTER PIPELINE AUTOMATION (V8 - LIBERAL & TEST MODE)
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
  log("🏁 Factory Ignition: Google Sheet Automation & Flash Active.");

  // 🧪 SAFETY SWITCH: Set to false when you are ready to deploy real files!
  const IS_TEST_MODE = true; 
  
  if (IS_TEST_MODE) {
    log("⚠️ TEST MODE IS ENABLED. No API tokens will be spent. No code will be pushed.");
  }

  const props = PropertiesService.getScriptProperties();
  const INVENTORY_SHEET_ID = props.getProperty("INVENTORY_SHEET_ID");
  const OUTPUT_FOLDER_ID = props.getProperty("OUTPUT_FOLDER_ID");
  const GEMINI_API_KEY = props.getProperty("GEMINI_API_KEY");

  if (!INVENTORY_SHEET_ID || !OUTPUT_FOLDER_ID || !GEMINI_API_KEY) {
    log("❌ CRITICAL ERROR: Core script properties missing. Exiting pipeline.");
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

  if (colIndex.driveLink === -1) {
    log("❌ CRITICAL SHEET FAULT: Could not find a column named 'Drive Link' in headers.");
    flushLogsToDrive();
    return;
  }

  let taskQueue = [];
  let sessionConversions = 0;

  for (let r = 1; r < data.length; r++) {
    const currentStatus = data[r][colIndex.status].toString().trim();
    if (currentStatus.includes("Pending") || currentStatus.includes("Discovered")) {
      taskQueue.push({ rowNum: r + 1, data: data[r] });
    }
  }

  log("📊 Spreadsheet Scan Complete. Found " + taskQueue.length + " chapters queued for compilation.");

  if (taskQueue.length === 0) {
    log("🎉 All assets verified green. Factory pipeline standing down.");
    flushLogsToDrive();
    return;
  }

  // 📝 NEW LIBERAL PROMPT: Encourages full narrative depth instead of aggressive truncation
  const liberalPrompt = `
You are an expert curriculum developer creating web-based textbooks. Extract the content from this document and convert it into rich, semantic HTML.

CRITICAL RULES FOR CHAPTER EXTRACTION:
1. YOU MUST USE THE EXACT JSON STRUCTURE DESIGNED FOR THE FACTORY: {"html_content": "<your_html_here>"}.
2. PRESERVE THE EDUCATIONAL NARRATIVE: Do not aggressively summarize. Keep detailed explanations, step-by-step mathematical examples, and historical context intact.
3. SEMANTIC HTML: Rely entirely on clean elements (<h1>, <h3>, <p>, <ul>, <li>, <details>, <summary>). Avoid repetitive inline CSS.
4. RICH TABLES & DATA: Preserve all tables and formulas accurately. Ensure full context is carried over.
5. KEYWORDS: Every important concept, scientific term, or mathematical definition MUST be wrapped in a <span class="keyword"> tag.
6. DELIVER FULL CONTEXT: Do not truncate or drop narrative filler. The web platform can handle massive files, so prioritize a complete, comprehensive, and engaging read.
  `;

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
      log("❌ STORAGE FAULT: Missing or invalid Google Drive URL.");
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("❌ MISSING LINK");
      flushLogsToDrive();
      continue;
    }

    try {
      const fileIdMatch = driveUrl.match(/[-\w]{25,}(?!.*[-\w]{25,})/);
      if (!fileIdMatch) throw new Error("Could not parse File ID.");
      pdfBlob = DriveApp.getFileById(fileIdMatch[0]).getBlob();
    } catch (driveErr) {
      log("❌ DRIVE ACCESS FAULT: " + driveErr.toString());
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("❌ DRIVE BLOB FAULT");
      flushLogsToDrive();
      continue;
    }

    const sanitizedSubject = subject.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const sanitizedClass = classLevel.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const sanitizedTitle = chapterTitle.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    const finalPath = sanitizedSubject + "/" + sanitizedClass + "/" + sanitizedTitle + ".html";

    // 🛑 TEST MODE INTERCEPT
    if (IS_TEST_MODE) {
      log("🧪 [DRY-RUN] Verified PDF Blob size: " + pdfBlob.getBytes().length + " bytes.");
      log("🧪 [DRY-RUN] Calculated Git path: " + finalPath);
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("🧪 Test Passed");
      sheet.getRange(task.rowNum, colIndex.path + 1).setValue(finalPath);
      continue; // Skips real Gemini API and Git pushes!
    }

    // --- REAL PRODUCTION BLOCKS ---
    let cleanHtmlPayload = "";
    try {
      const optimalModel = "gemini-1.5-flash"; // Upgraded to 1.5 Flash for better large-context handling
      let apiResponseRaw = callGeminiAPI(pdfBlob, liberalPrompt, optimalModel, GEMINI_API_KEY);
      let parsedJson = JSON.parse(apiResponseRaw);
      cleanHtmlPayload = parsedJson.html_content;
      
      if (!cleanHtmlPayload) throw new Error("html_content string parsed empty.");
    } catch (parseError) {
      log("❌ PARSE FAULT: AI structure failed. Error: " + parseError.toString());
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("⚠️ Output Fault");
      continue;
    }

    const stagingBranchName = "factory-builds";
    const commitSuccess = pushFileToBitbucketWithJira(finalPath, cleanHtmlPayload, stagingBranchName);

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
      }
    } else {
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("❌ Deploy Fault");
    }

    SpreadsheetApp.flush();
    flushLogsToDrive();
    Utilities.sleep(4000); // Breathe API
  }
  flushLogsToDrive();
}

/**
 * API DRIVER
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
      "temperature": 0.2
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
  return json.candidates[0].content.parts[0].text;
}

/**
 * GIT DEPLOYMENT ENGINES
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
    "title": "🔮 [Alchemist Build] Merge Staging to Main",
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
    const title = "alchemist-log-" + new Date().toISOString().slice(0, 10) + ".txt";
    const files = folder.getFilesByName(title);
    let file = files.hasNext() ? files.next() : folder.createFile(title, "", MimeType.PLAIN_TEXT);
    file.setContent(file.getBlob().getDataAsString() + logBuffer.join("\n") + "\n");
    logBuffer = [];
  } catch (e) {}
}