// =====================================================================
// 🔮 THE ALCHEMIST CORE: MASTER PIPELINE AUTOMATION (V7 - MULTI-MODE AUTOMATION)
// =====================================================================

let logBuffer = [];

function log(msg) {
  Logger.log(msg);
  logBuffer.push(new Date().toLocaleTimeString() + " - " + msg);
}

/**
 * MAIN EXECUTION ENGINE
 * Orchestrates Sheet reading, Native Drive PDF fetching, Gemini 3.5 processing, and Bitbucket pushes.
 */
function runAlchemistAutomatedFactory() {
  log("🏁 Factory Ignition: Google Sheet Automation & 3.5 Flash Active.");

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
    if (currentStatus.includes("Pending")) {
      taskQueue.push({ rowNum: r + 1, data: data[r] });
    }
  }

  log("📊 Spreadsheet Scan Complete. Found " + taskQueue.length + " chapters queued for compilation.");

  if (taskQueue.length === 0) {
    log("🎉 All assets verified green. Factory pipeline standing down.");
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

    let cleanHtmlPayload = "";
    try {
      const optimalModel = "gemini-3.5-flash";
      let apiResponseRaw = callGeminiAPI(pdfBlob, promptTemplate, optimalModel, GEMINI_API_KEY);
      let parsedJson = JSON.parse(apiResponseRaw);
      cleanHtmlPayload = parsedJson.html_content;
      
      if (!cleanHtmlPayload) throw new Error("html_content string parsed empty.");
    } catch (parseError) {
      log("❌ PARSE FAULT: AI structure truncated. Error: " + parseError.toString());
      sheet.getRange(task.rowNum, colIndex.status + 1).setValue("⚠️ Output Truncated");
      continue;
    }

    const sanitizedSubject = subject.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const sanitizedClass = classLevel.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const sanitizedTitle = chapterTitle.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    const finalPath = sanitizedSubject + "/" + sanitizedClass + "/" + sanitizedTitle + ".html";

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
    Utilities.sleep(4000);
  }
  flushLogsToDrive();
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

// =====================================================================
// 🌐 SYNCHRONIZERS & UTILITIES
// =====================================================================

/**
 * DYNAMIC COLLAPSIBLE NAVIGATION BUILDING ENGINE
 */
function buildDynamicIndex() {
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
  <title>Study Alchemist - Curriculum Home</title>
  <style>
    body { font-family: sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;}
    .clean-list { list-style-type: none; padding-left: 10px; border-left: 2px solid #eee; margin-left: 10px; margin-bottom: 10px; }
    .keyword a { color: #0056b3; text-decoration: none; font-size: 1.05em; }
    .keyword a:hover { text-decoration: underline; color: #003d82; }
    .chapter-row { margin-bottom: 12px; }
    .topic-box { margin-bottom: 15px; border: 1px solid #ddd; padding: 15px; border-radius: 8px; background-color: #fafafa; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .topic-title { font-size: 1.3em; font-weight: bold; cursor: pointer; padding: 5px 0; color: #2c3e50; }
    .class-title { font-size: 1.1em; font-weight: 600; cursor: pointer; margin-top: 10px; padding: 5px 0; color: #34495e; }
    
    details > summary { list-style: none; outline: none; transition: color 0.2s; position: relative; padding-left: 20px;}
    details > summary::-webkit-details-marker { display: none; }
    details > summary:hover { color: #0056b3; }
    details > summary::before { content: '[+] '; position: absolute; left: 0; font-weight: bold; color: #888; font-size: 1em; }
    details[open] > summary::before { content: '[-] '; color: #0056b3; }
  </style>
</head>
<body>
  <div class="nav-bar" style="margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 10px;">
    <h2>Study Alchemist Curriculum Database</h2>
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
    Logger.log("✅ SUCCESS: Immaculate, safe index.html successfully generated and pushed!");
  }
}