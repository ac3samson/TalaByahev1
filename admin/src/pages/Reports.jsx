import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import { api } from '../api';
import PageState from '../components/PageState';

function todayInManila() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

function money(value) {
  return `₱${Number(value || 0).toLocaleString()}`;
}

function buildSheetData(report) {
  if (report.type === 'trip') {
    return {
      headers: ['Trip ID', 'Route', 'Bus', 'Conductor', 'Tickets', 'Earnings'],
      rows: (report.rows || []).map((row) => [
        row.tripId,
        row.route,
        row.bus,
        row.conductor,
        row.tickets,
        Number(row.earnings || 0),
      ]),
    };
  }
  if (report.type === 'conductor') {
    return {
      headers: ['Conductor', 'Employee ID', 'Trips', 'Tickets', 'Revenue'],
      rows: (report.rows || []).map((row) => [
        row.conductor,
        row.conductorId,
        row.trips,
        row.tickets,
        Number(row.revenue || 0),
      ]),
    };
  }
  const rows = (report.rows || []).map((row) => [
    row.ticketId,
    row.segment,
    Number(row.fare || 0),
    row.conductor,
    row.time,
  ]);
  const fareTotal = rows.reduce((sum, row) => sum + Number(row[2] || 0), 0);
  rows.push(['', '', `Total: ${fareTotal}`, '', '']);

  return {
    headers: ['Ticket ID', 'Route Segment', 'Fare', 'Conductor', 'Time'],
    rows,
  };
}

function styleCell(value, { bold = false } = {}) {
  return {
    v: value,
    t: typeof value === 'number' ? 'n' : 's',
    s: {
      font: { bold, name: 'Calibri', sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    },
  };
}

function downloadExcel(report) {
  const { headers, rows } = buildSheetData(report);
  const aoa = [
    headers.map((header) => styleCell(header, { bold: true })),
    ...rows.map((values, rowIndex) =>
      values.map((value, colIndex) => {
        const isDailyTotal =
          report.type === 'daily' && rowIndex === rows.length - 1 && colIndex === 2;
        return styleCell(value, { bold: isDailyTotal });
      }),
    ),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!cols'] = headers.map((header, index) => {
    let max = String(header).length;
    rows.forEach((values) => {
      max = Math.max(max, String(values[index] ?? '').length);
    });
    return { wch: Math.min(Math.max(max + 2, 12), 40) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  XLSX.writeFile(workbook, `TalaByahe-${report.type || 'daily'}-${report.date}.xlsx`);
}

export default function Reports() {
  const [reportType, setReportType] = useState('daily');
  const [date, setDate] = useState(todayInManila);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.reports
      .summary(date, reportType)
      .then((data) => {
        if (cancelled) return;
        setReport(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setReport(null);
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, reportType]);

  const handleGenerate = async () => {
    setExporting(true);
    setError(null);
    try {
      const data = await api.reports.summary(date, reportType);
      setReport(data);
      downloadExcel(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Reports</h2>
      </div>
      <div className="card">
        <div className="card-header-row">
          <h3>Generate Report</h3>
          <button
            type="button"
            className="btn-primary"
            onClick={handleGenerate}
            disabled={exporting || loading}
          >
            {exporting ? 'Generating…' : 'Generate'}
          </button>
        </div>
        <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label>Report Type</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
              <option value="daily">Daily Earnings Summary</option>
              <option value="trip">Per-Trip Performance</option>
              <option value="conductor">Conductor Collection Report</option>
            </select>
          </div>
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="report-preview">
          <div className="report-preview-header">
            <h4>Preview</h4>
            <span className="report-preview-date">{date}</span>
          </div>
          <PageState loading={loading} error={error}>
            {report && (
              <>
                {reportType === 'daily' && (
                  <table className="table" style={{ marginTop: '1.25rem' }}>
                    <thead>
                      <tr>
                        <th>Ticket ID</th>
                        <th>Route Segment</th>
                        <th>Fare</th>
                        <th>Conductor</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report.rows || []).length === 0 ? (
                        <tr>
                          <td colSpan={5}>No ticket sales found for this date.</td>
                        </tr>
                      ) : (
                        report.rows.map((row) => (
                          <tr key={row.ticketId}>
                            <td>{row.ticketId}</td>
                            <td>{row.segment}</td>
                            <td>{money(row.fare)}</td>
                            <td>{row.conductor}</td>
                            <td>{row.time}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {reportType === 'trip' && (
                  <table className="table" style={{ marginTop: '1.25rem' }}>
                    <thead>
                      <tr>
                        <th>Trip</th>
                        <th>Route</th>
                        <th>Bus</th>
                        <th>Conductor</th>
                        <th>Tickets</th>
                        <th>Earnings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report.rows || []).length === 0 ? (
                        <tr>
                          <td colSpan={6}>No trips found for this date.</td>
                        </tr>
                      ) : (
                        report.rows.map((row) => (
                          <tr key={row.tripId}>
                            <td>{row.tripId}</td>
                            <td>{row.route}</td>
                            <td>{row.bus}</td>
                            <td>{row.conductor}</td>
                            <td>{row.tickets}</td>
                            <td>{money(row.earnings)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {reportType === 'conductor' && (
                  <table className="table" style={{ marginTop: '1.25rem' }}>
                    <thead>
                      <tr>
                        <th>Conductor</th>
                        <th>Employee ID</th>
                        <th>Trips</th>
                        <th>Tickets</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report.rows || []).length === 0 ? (
                        <tr>
                          <td colSpan={5}>No conductor collections found for this date.</td>
                        </tr>
                      ) : (
                        report.rows.map((row) => (
                          <tr key={`${row.conductorId}-${row.conductor}`}>
                            <td>{row.conductor}</td>
                            <td>{row.conductorId}</td>
                            <td>{row.trips}</td>
                            <td>{row.tickets}</td>
                            <td>{money(row.revenue)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </PageState>
        </div>
      </div>
    </div>
  );
}
