/**
 * THERMAL RECEIPT LAYOUT (58mm / ~32 characters wide)
 * Edit this file to change what gets printed.
 *
 * Paper preview:
 *
 * ========================================
 *         H.M. TRANSPORT, INC.
 *      Jam Compound Tubigan 4024
 *   City of Binan Laguna Philippines
 *         Non-VAT Reg. TIN:
 *          005-748-554-000
 *    Provincial Bus Ticket Invoice
 * ----------------------------------------
 *            TKT-261116-001
 *             11/16/2026
 *
 * From                 Terminal A
 * To                   Town Center
 * Time                      10:15
 * Conductor         Juan Dela Cruz
 *
 * Regular fare                  P25   (only if discounted)
 * Discount                      20%
 * (Senior)  — or PWD / Student
 *
 * TOTAL FARE                    P20
 * <one blank line>
 */

import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';

const COLUMNS = 32;

const COMPANY_NAME = 'H.M. TRANSPORT, INC.';
// Keep each line short so it stays visually centered on 58mm paper.
const COMPANY_ADDRESS_LINES = [
  'Jam Compound Tubigan 4024',
  'City of Binan Laguna Philippines',
];
const COMPANY_TIN_LABEL = 'Non-VAT Reg. TIN:';
const COMPANY_TIN_VALUE = '005-748-554-000';
const COMPANY_SUBTITLE = 'Provincial Bus Ticket Invoice';

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString('en-PH');
}

function money(amount) {
  return `P${Number(amount ?? 0)}`;
}

function headerLines() {
  return [
    COMPANY_NAME,
    ...COMPANY_ADDRESS_LINES,
    COMPANY_TIN_LABEL,
    COMPANY_TIN_VALUE,
    COMPANY_SUBTITLE,
  ];
}

/**
 * Builds ESC/POS bytes for the PT-210 / MTP-2 (58mm).
 * Note: printers often lack ₱ — we print "P" for peso.
 * Note: ñ may not print on some devices, so address uses "Binan".
 */
export function buildTicketReceipt(ticket) {
  const encoder = new ReceiptPrinterEncoder({
    columns: COLUMNS,
    language: 'esc-pos',
    // Closest built-in profile for PT-210 / MTP-2 class printers
    printerModel: 'mpt-ii',
  });

  encoder.initialize().align('center').bold(true).line(COMPANY_NAME).bold(false);

  for (const line of COMPANY_ADDRESS_LINES) {
    encoder.align('center').line(line);
  }

  encoder
    .align('center')
    .line(COMPANY_TIN_LABEL)
    .line(COMPANY_TIN_VALUE)
    .line(COMPANY_SUBTITLE)
    .newline()
    .line('-'.repeat(COLUMNS))
    .bold(true)
    .line(String(ticket.id || ''))
    .bold(false)
    .line(formatDate(ticket.issuedAt || ticket.date))
    .newline()
    .align('left');

  const rows = [
    ['From', ticket.from],
    ['To', ticket.to],
    ['Time', ticket.time],
    ['Conductor', ticket.conductor],
  ];

  for (const [label, value] of rows) {
    encoder.line(padRow(label, String(value ?? '—')));
  }

  if (ticket.discountApplied) {
    encoder.newline();
    encoder.line(padRow('Regular fare', money(ticket.baseFare)));
    encoder.line(padRow('Discount', `${ticket.discountPercent}%`));
    if (ticket.discountType) {
      encoder.line(`(${ticket.discountType})`);
    }
  }

  encoder
    .newline()
    .line('-'.repeat(COLUMNS))
    .align('left')
    .bold(true)
    .line(padRow('TOTAL FARE', money(ticket.fare)))
    .bold(false)
    // Three blank text-height lines after TOTAL FARE, then stop.
    // No ESC/POS cut — PT-210 has no cutter and cut wastes a long blank strip.
    .line(' ')
    .line(' ')
    .line(' ');

  return encoder.encode();
}

/** Human-readable preview of the same layout (for UI / debugging). */
export function previewTicketReceipt(ticket) {
  const lines = [
    ...headerLines(),
    '-'.repeat(COLUMNS),
    String(ticket.id || ''),
    formatDate(ticket.issuedAt || ticket.date),
    '',
    padRow('From', String(ticket.from ?? '—')),
    padRow('To', String(ticket.to ?? '—')),
    padRow('Time', String(ticket.time ?? '—')),
    padRow('Conductor', String(ticket.conductor ?? '—')),
  ];

  if (ticket.discountApplied) {
    lines.push('');
    lines.push(padRow('Regular fare', money(ticket.baseFare)));
    lines.push(padRow('Discount', `${ticket.discountPercent}%`));
    if (ticket.discountType) {
      lines.push(`(${ticket.discountType})`);
    }
  }

  lines.push('');
  lines.push('-'.repeat(COLUMNS));
  lines.push(padRow('TOTAL FARE', money(ticket.fare)));
  return lines.join('\n');
}

function padRow(left, right) {
  const maxRight = Math.max(1, COLUMNS - left.length - 1);
  const clippedRight = right.length > maxRight ? right.slice(0, maxRight) : right;
  const spaces = Math.max(1, COLUMNS - left.length - clippedRight.length);
  return `${left}${' '.repeat(spaces)}${clippedRight}`;
}
