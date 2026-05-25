// =====================================================================
// 📁 THE ALCHEMIST SCANNER: ZERO-TOKEN DRIVE-TO-SHEET MAPPER (V3)
// =====================================================================

function autoMapDriveFolderLinks() {
  const props = PropertiesService.getScriptProperties();
  var parentFolderId = props.getProperty("MASTER_FOLDER_ID"); 
  
  if (!parentFolderId) {
    Logger.log("❌ ERROR: 'MASTER_FOLDER_ID' is missing from Script Properties.");
    return;
  }
  
  var parentFolder = DriveApp.getFolderById(parentFolderId);
  var subFolders = parentFolder.getFolders();
  
  // 🎯 THE SECRET SAUCE: Static structural maps of exact NCERT Math chapters
  // This replaces the AI entirely—running instantly for $0.00.
  var mathMasterIndex = {
    "Class 8-1": {
      1: "Rational Numbers",
      2: "Linear Equations in One Variable",
      3: "Understanding Quadrilaterals",
      4: "Data Handling"
    },
    "Class 8-2": {
      5: "Squares and Square Roots",
      6: "Cubes and Cube Roots",
      7: "Comparing Quantities",
      8: "Algebraic Expressions and Identities",
      9: "Mensuration",
      10: "Exponents and Powers",
      11: "Direct and Inverse Proportions",
      12: "Factorisation",
      13: "Introduction to Graphs"
    },
    "Class 9": {
      1: "Number Systems",
      2: "Polynomials",
      3: "Coordinate Geometry",
      4: "Linear Equations in Two Variables",
      5: "Introduction to Euclid Geometry",
      6: "Lines and Angles",
      7: "Triangles",
      8: "Quadrilaterals",
      9: "Circles",
      10: "Herons Formula",
      11: "Surface Areas and Volumes",
      12: "Statistics"
    },
    "Class 10": {
      1: "Real Numbers",
      2: "Polynomials",
      3: "Pair of Linear Equations in Two Variables",
      4: "Quadratic Equations",
      5: "Arithmetic Progressions",
      6: "Triangles",
      7: "Coordinate Geometry",
      8: "Introduction to Trigonometry",
      9: "Some Applications of Trigonometry",
      10: "Circles",
      11: "Area Related to Circles",
      12: "Surface Areas and Volumes",
      13: "Statistics",
      14: "Probability"
    }
  };

  var ncertDecoder = {
    "hegp1dd": { subject: "Mathematics", classLevel: "Class 8-1" },
    "hegp2dd": { subject: "Mathematics", classLevel: "Class 8-2" },
    "iemh1dd": { subject: "Mathematics", classLevel: "Class 9" },
    "jemh1dd": { subject: "Mathematics", classLevel: "Class 10" }
  };
  
  var rowsToAppend = [];
  Logger.log("🔄 Starting lightning-fast local index compilation...");
  
  while (subFolders.hasNext()) {
    var folder = subFolders.next();
    var folderName = folder.getName().trim().toLowerCase(); 
    
    if (ncertDecoder.hasOwnProperty(folderName)) {
      var meta = ncertDecoder[folderName];
      var files = folder.getFiles();
      
      while (files.hasNext()) {
        var file = files.next();
        var fileName = file.getName().trim();
        
        if (fileName.toLowerCase().endsWith(".pdf")) {
          var rawName = fileName.replace(/\.pdf$/i, "").trim();
          
          // Parse out the chapter code index (e.g., jemh104 -> 04 -> Chapter 4)
          var chapterNo = 0;
          var ncertCodeMatch = rawName.match(/[a-z]{4}\d(\d{2})/i);
          if (ncertCodeMatch) {
            chapterNo = parseInt(ncertCodeMatch[1], 10);
          }
          
          // Match the parsed number directly against our local index map
          var chapterTitle = "Chapter " + chapterNo; // Default Fallback
          if (mathMasterIndex[meta.classLevel] && mathMasterIndex[meta.classLevel][chapterNo]) {
            chapterTitle = mathMasterIndex[meta.classLevel][chapterNo];
          }
          
          // Generate clean, deterministic web slugs
          var slugifiedTitle = chapterTitle.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-');
          var classSlug = meta.classLevel.toLowerCase().replace(/\s+/g, '-');
          var bitbucketPath = meta.subject.toLowerCase() + "/" + classSlug + "/" + slugifiedTitle + ".html";
          
          rowsToAppend.push([
            meta.subject,       // A: Subject
            meta.classLevel,    // B: Class Level
            chapterNo,          // C: Chapter No.
            chapterTitle,       // D: Chapter Title
            "Pending",          // E: Status (Freshly prepped for the main factory pipeline)
            bitbucketPath,      // F: Bitbucket Path (Auto)
            file.getUrl()       // G: Individual PDF Drive Link
          ]);
        }
      }
    }
  }
  
  writeMapToSheet(rowsToAppend);
}

function writeMapToSheet(rowsData) {
  const props = PropertiesService.getScriptProperties();
  var inventorySheetId = props.getProperty("INVENTORY_SHEET_ID");
  
  var ss = SpreadsheetApp.openById(inventorySheetId);
  var sheet = ss.getSheetByName("Mathematics Mapping");
  if (!sheet) sheet = ss.insertSheet("Mathematics Mapping");
  
  sheet.clearContents();
  sheet.appendRow(["Subject", "Class Level", "Chapter No.", "Chapter Title", "Status", "Bitbucket Path (Auto)", "Drive Link"]);
  
  if (rowsData.length > 0) {
    rowsData.sort(function(a, b) {
      if (a[1] !== b[1]) return a[1].localeCompare(b[1]);
      return (a[2] || 0) - (b[2] || 0);
    });
    sheet.getRange(2, 1, rowsData.length, 7).setValues(rowsData);
  }
  Logger.log("🚀 Mapping complete! " + rowsData.length + " rows mapped flawlessly for zero tokens.");
}