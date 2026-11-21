// Account records + owner dashboard (Google Apps Script web app inside the 「一夜狼人殺 帳戶紀錄」 Google Sheet).
// Paste the web app URL (…/exec) here. Empty = accounts and logging are off and the game runs as before.
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbymlEmOFetmEUFU4HVmh4VFlBJCFl-kC4aMFN4C9vwh0sPdEX8_ZFzulDFWObLVe2DmVg/exec';
// Logging only runs on the published sites (not in local tests or the Claude artifact copy).
export const TRACK_HOSTS = /(^|\.)onrender\.com$|(^|\.)github\.io$/;
