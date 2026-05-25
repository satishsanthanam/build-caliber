function autoMapDriveFolderLinks() {
  // 🔐 Pull parent folder ID from Script Properties
  const props = PropertiesService.getScriptProperties();
  var parentFolderId = props.getProperty("MASTER_FOLDER_ID"); 
  
  if (!parentFolderId) {
    Logger.log("❌ ERROR: 'MASTER_FOLDER_ID' is not set in Script Properties.");
    return;
  }
  
  var parentFolder = DriveApp.getFolderById(parentFolderId);
  var subFolders = parentFolder.getFolders();
  
  // 🎯 FIXED: Corrected mapping for Class 8 Math books
  var ncertDecoder = {
    "hegp1dd": { subject: "Mathematics", classLevel: "Class 8-1" },
    "hegp2dd": { subject: "Mathematics", classLevel: "Class 8-2" },
    "iemh1dd": { subject: "Mathematics", classLevel: "Class 9" },
    "jemh1dd": { subject: "Mathematics", classLevel: "Class 10" }
  };
  
  var rowsToAppend = [];
  Logger.log("🔄 Running file-level scan for Mathematics Chapter PDFs...");
  
  while (subFolders.hasNext()) {
    var folder = subFolders.next();
    var folderName = folder.getName().trim().toLowerCase(); 
    
    if (ncertDecoder.hasOwnProperty(folderName)) {
      var meta = ncertDecoder[folderName];
      Logger.log("🎯 Scanning PDF files inside folder: " + folderName + " ➔ " + meta.classLevel);
      
      var files = folder.getFiles();
      while (files.hasNext()) {
        var file = files.next();
        var fileName = file.getName().trim();
        
        // Isolate and process only PDF extensions
        if (fileName.toLowerCase().endsWith(".pdf")) {
          var rawName = fileName.replace(/\.pdf$/i, "").trim();
          var chapterNo = "";
          var chapterTitle = rawName;
          
          // Pattern A: Standard naming ("Chapter 1 - Rational Numbers", etc.)
          var standardMatch = rawName.match(/^(?:Chapter\s+)?(\d+)[\s.\-_]*(.*)$/i);
          
          // Pattern B: Raw NCERT code naming (e.g., "hegp101")
          var ncertCodeMatch = rawName.match(/[a-z]{4}\d(\d{2})/i);
          
          if (standardMatch) {
            chapterNo = parseInt(standardMatch[1], 10);
            chapterTitle = standardMatch[2].trim();
          } else if (ncertCodeMatch) {
            chapterNo = parseInt(ncertCodeMatch[1], 10);
            chapterTitle = "Chapter " + chapterNo;
          }
          
          if (!chapterTitle) { chapterTitle = rawName; }
          
          // Generate uniform Bitbucket paths (e.g., mathematics/class-8-1/rational-numbers.html)
          var slugifiedTitle = chapterTitle.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-');
          var classSlug = meta.classLevel.toLowerCase().replace(/\s+/g, '-');
          var bitbucketPath = meta.subject.toLowerCase() + "/" + classSlug + "/" + slugifiedTitle + ".html";
          
          // Push 1:1 row values matching Sheet1 layout
          rowsToAppend.push([
            meta.subject,       // A: Subject
            meta.classLevel,    // B: Class Level
            chapterNo,          // C: Chapter No.
            chapterTitle,       // D: Chapter Title
            "🔄 Discovered",    // E: Status
            bitbucketPath,      // F: Bitbucket Path (Auto)
            file.getUrl()       // G: PDF Drive Link
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
  
  if (!inventorySheetId) {
    Logger.log("❌ ERROR: 'INVENTORY_SHEET_ID' is not set in Script Properties.");
    return;
  }
  
  var ss = SpreadsheetApp.openById(inventorySheetId);
  var sheet = ss.getSheetByName("Mathematics Mapping");
  
  if (!sheet) {
    sheet = ss.insertSheet("Mathematics Mapping");
  }
  
  sheet.clearContents();
  
  sheet.appendRow([
    "Subject", 
    "Class Level", 
    "Chapter No.", 
    "Chapter Title", 
    "Status", 
    "Bitbucket Path (Auto)", 
    "Drive Link"
  ]);
  
  if (rowsData.length > 0) {
    // Sort items sequentially by Class Level and then Chapter Number
    rowsData.sort(function(a, b) {
      if (a[1] !== b[1]) return a[1].localeCompare(b[1]);
      return (a[2] || 0) - (b[2] || 0);
    });
    
    sheet.getRange(2, 1, rowsData.length, 7).setValues(rowsData);
  }
  
  Logger.log("🚀 Mapping complete! " + rowsData.length + " entries successfully formatted into Sheet1 structure.");
}