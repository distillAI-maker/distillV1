/**
 * Distill email list: everyone who joined the waitlist or made an app account, refreshed every
 * 15 minutes from Supabase. Paste this into the sheet's Extensions > Apps Script (docs/EMAIL-SHEET.md).
 *
 * The publishable key below is the same public one the website uses. What lets this sheet read the
 * list is SHEET_KEY: a long random key made by "Set up" and kept in this script's private
 * properties. Only its SHA-256 goes to Supabase, so the key itself is never written anywhere else.
 */
const SUPABASE_URL = 'https://hzwiikkttligpmkvondy.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_LnnDGCp21cdBGXzoBx-yZQ_MDoWAubE';
const TAB = 'Emails';
const HEADERS = ['Email', 'Type', 'Joined', 'Wearable', 'Form', 'Confirmed email', 'Last sign-in', 'Onboarding step'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Distill')
    .addItem('Refresh now', 'refresh')
    .addItem('Set up (once)', 'setup')
    .addToUi();
}

/** Makes the key (once), starts the 15-minute refresh, and shows the code to register in Supabase. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('SHEET_KEY');
  if (!key) {
    key = (Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    props.setProperty('SHEET_KEY', key);
  }
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'refresh')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('refresh').timeBased().everyMinutes(15).create();
  const code = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, key, Utilities.Charset.UTF_8)
    .map((b) => ((b + 256) % 256).toString(16).padStart(2, '0'))
    .join('');
  SpreadsheetApp.getUi().alert(
    'Distill email list',
    'Refreshing every 15 minutes is on.\n\nRegister this sheet in Supabase with this code (safe to share; it is not the key):\n\n' + code,
    SpreadsheetApp.getUi().ButtonSet.OK,
  );
}

/** Rewrites the Emails tab from Supabase. Runs every 15 minutes, and from Distill > Refresh now. */
function refresh() {
  const key = PropertiesService.getScriptProperties().getProperty('SHEET_KEY');
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book.getSheetByName(TAB) || book.insertSheet(TAB, 0);
  const status = (text) => sheet.getRange('J1').setValue(text);
  if (!key) return status('Run Distill > Set up (once) first.');

  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/distill_email_list', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: PUBLISHABLE_KEY },
    payload: JSON.stringify({ p_key: key }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    const why = res.getResponseCode() === 403 || /not allowed/.test(res.getContentText())
      ? 'This sheet is not registered in Supabase yet (see docs/EMAIL-SHEET.md).'
      : 'Supabase answered ' + res.getResponseCode() + '. Trying again in 15 minutes.';
    return status('Not updated: ' + why);
  }

  const when = (iso) => (iso ? new Date(iso) : '');
  const rows = JSON.parse(res.getContentText()).map((r) => [
    r.email,
    r.kind,
    when(r.joined_at),
    r.wearable || '',
    r.form || '',
    when(r.confirmed_at),
    when(r.last_sign_in_at),
    r.onboarding || '',
  ]);

  sheet.getRange(1, 1, sheet.getMaxRows(), HEADERS.length).clearContent();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    sheet.getRange(2, 3, rows.length, 1).setNumberFormat('yyyy-mm-dd hh:mm');
    sheet.getRange(2, 6, rows.length, 2).setNumberFormat('yyyy-mm-dd hh:mm');
  }
  sheet.setFrozenRows(1);
  const waitlist = rows.filter((r) => r[1] === 'waitlist').length;
  status('Updated ' + Utilities.formatDate(new Date(), book.getSpreadsheetTimeZone(), 'MMM d, h:mm a') +
    ' · ' + waitlist + ' waitlist, ' + (rows.length - waitlist) + ' app accounts');
}
