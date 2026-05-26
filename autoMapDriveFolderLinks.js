/**
 * AUTOMATED FOLDER & PATH MAPPING ENGINE
 * Sweeps through the active inventory sheet, reads current curriculum metadata,
 * and automatically pre-calculates uniform Bitbucket target paths using the strict 48-char format.
 */
function autoMapDriveFolderLinks() {
  Logger.log("🏁 Starting automated spreadsheet path mapping alignment...");
  
  const props = PropertiesService.getScriptProperties();
  const INVENTORY_SHEET_ID = props.getProperty("INVENTORY_SHEET_ID");
  
  if (!INVENTORY_SHEET_ID) {
    Logger.log("❌ ERROR: Script property INVENTORY_SHEET_ID is missing.");
    return;
  }

  const sheet = SpreadsheetApp.openById(INVENTORY_SHEET_ID).getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // Map header column integer tracking arrays
  const col = {
    subject: headers.indexOf("Subject"),
    classLevel: headers.indexOf("Class Level"),
    chapterNo: headers.indexOf("Chapter No."),
    title: headers.indexOf("Chapter Title"),
    path: headers.indexOf("Bitbucket Path (Auto)")
  };

  if (col.subject === -1 || col.classLevel === -1 || col.chapterNo === -1 || col.title === -1 || col.path === -1) {
    Logger.log("❌ CRITICAL ERROR: Mandatory headers are missing or renamed inside the tracking worksheet.");
    return;
  }

  let updateCount = 0;

  // Process rows sequentially
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const subjectRaw = row[col.subject].toString().trim();
    const classRaw = row[col.classLevel].toString().trim();
    const chapRaw = row[col.chapterNo].toString().trim();
    const titleRaw = row[col.title].toString().trim();

    // Skip empty configuration slots
    if (!subjectRaw || !classRaw || !titleRaw) continue;

    // ==========================================
    // 1. EXTRACT & ZERO-PAD CLASS LEVEL (mm)
    // ==========================================
    let mm = "00";
    const classDigits = classRaw.match(/\d+/);
    if (classDigits) {
      mm = parseInt(classDigits[0], 10).toString();
      if (mm.length < 2) mm = "0" + mm; // Dynamic zero-padding formatting
    }

    // ==========================================
    // 2. EXTRACT & ZERO-PAD CHAPTER NO. (nn)
    // ==========================================
    let nn = "00";
    const chapDigits = chapRaw.match(/\d+/);
    if (chapDigits) {
      nn = parseInt(chapDigits[0], 10).toString();
      if (nn.length < 2) nn = "0" + nn;
    }

    // ==========================================
    // 3. GENERATE SANITIZED SLUG TOPIC TEXT
    // ==========================================
    let topicSlug = titleRaw.toLowerCase()
                            .replace(/[^a-z0-9\s-_]/g, "") // Strip punctuation
                            .replace(/[\s-_]+/g, "-")       // Standardize spacings to singular hyphens
                            .trim();
    if (topicSlug.startsWith("-")) topicSlug = topicSlug.substring(1);
    if (topicSlug.endsWith("-")) topicSlug = topicSlug.substring(0, topicSlug.length - 1);

    // ==========================================
    // 4. COMPUTE STABLE SUBFOLDER STRINGS (Volumetric Checks)
    // ==========================================
    const subjectSubfolder = subjectRaw.toLowerCase().replace(/[^a-z0-9]/g, "-");
    let classSubfolder = "class-" + parseInt(mm, 10); // Base fallback: class-8, class-9
    
    // Dynamic Volumetric Mapping Check (e.g., "Class 8 Part 1" or "Class 8-2")
    const partDigits = classRaw.match(/(?:part|volume|term)[-_\s]*(\d+)/i) || classRaw.match(/class[-_\s]*\d+[-_\s]*(\d+)/i);
    if (partDigits) {
      classSubfolder = classSubfolder + "-" + partDigits[1]; // Evaluates cleanly to: class-8-1, class-8-2
    }

    // ==========================================
    // 5. ENFORCE 48-CHARACTER CRITICAL LENGTH LIMIT
    // ==========================================
    // Base layout: 'mm-chapter-nn-' is exactly 14 characters.
    // 48 max total characters - 14 prefix budget = 34 characters remaining for the topic slug.
    let truncatedSlug = topicSlug.substring(0, 34);
    if (truncatedSlug.endsWith("-")) {
      truncatedSlug = truncatedSlug.substring(0, truncatedSlug.length - 1);
    }

    const computedFileName = mm + "-chapter-" + nn + "-" + truncatedSlug + ".html";
    const deterministicPath = subjectSubfolder + "/" + classSubfolder + "/" + computedFileName;

    // Update spreadsheet tracking cell only if formatting differs
    if (row[col.path].toString().trim() !== deterministicPath) {
      sheet.getRange(r + 1, col.path + 1).setValue(deterministicPath);
      updateCount++;
    }
  }

  Logger.log("✅ COMPLETED: Path configuration sync run finalized. Updated " + updateCount + " file mappings.");
}