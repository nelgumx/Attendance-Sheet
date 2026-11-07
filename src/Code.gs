/**
 * Attendance System - Google Apps Script backend
 * Bound to a Google Sheet with two tabs: "Masterlist" and "Attendance".
 *
 * Flow:  index.html  ->  recordAttendance()  ->  Masterlist (lookup) + Attendance (log)
 */

const CONFIG = {
  MASTERLIST_SHEET: 'Masterlist',
  ATTENDANCE_SHEET: 'Attendance',
  // How long (in minutes) a person must wait before repeating the SAME action.
  // 480 = 8 hours. Change this number to adjust the rule.
  COOLDOWN_MINUTES: 480,
  TIMEZONE: 'Asia/Dubai'
};

const ATTENDANCE_HEADERS = [
  'Timestamp', 'Date', 'Time', 'Employee ID', 'Full Name',
  'Department', 'Position', 'Action'
];

/** Serves the web page. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Attendance')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Receives attendance clicks from the GitHub Pages version of the form. */
function doPost(e) {
  let result;
  try {
    const body = JSON.parse(e.postData.contents);
    result = recordAttendance(body.input, body.action);
  } catch (err) {
    result = { ok: false, message: 'Bad request.' };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Run this ONCE from the editor to create the Attendance tab with headers. */
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.ATTENDANCE_SHEET);
  if (!sh) sh = ss.insertSheet(CONFIG.ATTENDANCE_SHEET);
  if (sh.getLastRow() === 0) {
    sh.appendRow(ATTENDANCE_HEADERS);
    sh.getRange(1, 1, 1, ATTENDANCE_HEADERS.length).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sh.getRange('B:B').setNumberFormat('yyyy-mm-dd');
    sh.getRange('C:C').setNumberFormat('hh:mm:ss');
  }
}

/**
 * Called from the HTML page.
 * @param {string} input   Employee ID or full name typed by the user
 * @param {string} action  "Time In" or "Time Out"
 * @return {{ok:boolean, message:string}}
 */
function recordAttendance(input, action) {
  input = String(input || '').trim();
  if (!input) return { ok: false, message: 'Please enter your name or employee ID.' };
  if (action !== 'Time In' && action !== 'Time Out') {
    return { ok: false, message: 'Invalid action.' };
  }

  // Lock so two simultaneous clicks cannot both pass the cooldown check.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { ok: false, message: 'System is busy. Please try again.' };
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1) Find the employee in the Masterlist
    const emp = findEmployee_(ss, input);
    if (emp.error) return { ok: false, message: emp.error };

    // 2) Cooldown check against the Attendance log
    const sh = ss.getSheetByName(CONFIG.ATTENDANCE_SHEET);
    if (!sh) return { ok: false, message: 'Attendance sheet missing. Run setupSheets() first.' };

    const now = new Date();
    const last = lastRecord_(sh, emp.id, action);
    if (last) {
      const minutesAgo = (now - last) / 60000;
      if (minutesAgo < CONFIG.COOLDOWN_MINUTES) {
        const nextAllowed = new Date(last.getTime() + CONFIG.COOLDOWN_MINUTES * 60000);
        return {
          ok: false,
          message: emp.name + ', you already did ' + action + ' at ' +
            fmt_(last, 'HH:mm') + '. You can ' + action + ' again after ' +
            fmt_(nextAllowed, 'MMM d, HH:mm') + '.'
        };
      }
    }

    // 3) Write the record
    sh.appendRow([
      now,
      fmt_(now, 'yyyy-MM-dd'),
      fmt_(now, 'HH:mm:ss'),
      emp.id, emp.name, emp.department, emp.position, action
    ]);

    return {
      ok: true,
      message: action + ' recorded for ' + emp.name + ' at ' + fmt_(now, 'HH:mm:ss') + '.'
    };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- helpers ---------- */

function fmt_(date, pattern) {
  return Utilities.formatDate(date, CONFIG.TIMEZONE, pattern);
}

/** Looks up by Employee ID or exact Full Name (case-insensitive). */
function findEmployee_(ss, input) {
  const sh = ss.getSheetByName(CONFIG.MASTERLIST_SHEET);
  if (!sh) return { error: 'Masterlist sheet not found.' };

  const data = sh.getDataRange().getValues();
  const h = data[0].map(String);
  const col = {
    id: h.indexOf('Employee ID'),
    name: h.indexOf('Full Name'),
    dept: h.indexOf('Department'),
    pos: h.indexOf('Position'),
    status: h.indexOf('Status')
  };
  if (col.id < 0 || col.name < 0) {
    return { error: 'Masterlist must have "Employee ID" and "Full Name" columns.' };
  }

  const q = input.toLowerCase();
  const matches = data.slice(1).filter(function (r) {
    return String(r[col.id]).trim().toLowerCase() === q ||
           String(r[col.name]).trim().toLowerCase() === q;
  });

  if (matches.length === 0) return { error: 'Employee not found. Check your ID or full name.' };
  if (matches.length > 1) return { error: 'More than one match. Please use your Employee ID.' };

  const r = matches[0];
  if (col.status >= 0 && String(r[col.status]).trim().toLowerCase() !== 'active') {
    return { error: 'This employee record is not active. Please contact HR.' };
  }
  return {
    id: String(r[col.id]).trim(),
    name: String(r[col.name]).trim(),
    department: col.dept >= 0 ? r[col.dept] : '',
    position: col.pos >= 0 ? r[col.pos] : ''
  };
}

/** Returns the Date of this employee's most recent record for this action, or null. */
function lastRecord_(sh, empId, action) {
  const n = sh.getLastRow();
  if (n < 2) return null;
  const rows = sh.getRange(2, 1, n - 1, ATTENDANCE_HEADERS.length).getValues();
  for (let i = rows.length - 1; i >= 0; i--) {       // newest first
    if (String(rows[i][3]) === empId && rows[i][7] === action) {
      return new Date(rows[i][0]);
    }
  }
  return null;
}
