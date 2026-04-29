const { pool } = require('../config/database');
const ExcelJS = require('exceljs');

/**
 * Generate PM Reports with filters
 * Supports: summary, detailed, metrics, customer-specific reports
 */

const normalizeNumber = (value) => Number(value || 0);

const applyPmSequenceNumbers = (records = []) => {
  const ordered = [...records].sort((left, right) => {
    const leftDate = new Date(left.PM_Date || 0).getTime();
    const rightDate = new Date(right.PM_Date || 0).getTime();

    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }

    return Number(left.PM_ID) - Number(right.PM_ID);
  });

  const sequenceByAsset = new Map();
  const sequenceByPmId = new Map();

  ordered.forEach((record) => {
    const assetId = String(record.Asset_ID);
    const currentSequence = sequenceByAsset.get(assetId) || 0;
    const nextSequence = currentSequence + 1;
    sequenceByAsset.set(assetId, nextSequence);
    sequenceByPmId.set(Number(record.PM_ID), nextSequence);
  });

  return records.map((record) => ({
    ...record,
    PM_Sequence: sequenceByPmId.get(Number(record.PM_ID)) || 1
  }));
};

const classifyStatus = (status) => {
  const normalized = String(status || 'unknown').trim().toLowerCase();
  if (['completed', 'done', 'closed'].includes(normalized)) return 'completed';
  if (normalized.includes('unsigned') || normalized.includes('pending signature')) return 'unsigned';
  return 'incomplete';
};

const getPeriodLabel = (dateRange, startDate, endDate, start, end) => {
  if (dateRange === 'range') {
    return `${startDate || start || 'N/A'} to ${endDate || end || 'N/A'}`;
  }
  if (dateRange === 'contractToDate') {
    return 'Contract-to-date';
  }
  return `${start || 'N/A'} to ${end || 'N/A'}`;
};

const buildWhereClause = (start, end, customerId, projectId, completedOnly = false) => {
  const conditions = ['pm.deleted_at IS NULL'];
  const params = [];

  if (start && end) {
    conditions.push('DATE(pm.PM_Date) BETWEEN ? AND ?');
    params.push(start, end);
  }

  if (customerId) {
    conditions.push('(c.Customer_Name = ? OR c.Customer_Ref_Number = ? OR i.Customer_ID = ?)');
    params.push(customerId, customerId, customerId);
  }

  if (projectId) {
    conditions.push('i.Project_ID = ?');
    params.push(projectId);
  }

  if (completedOnly) {
    conditions.push("LOWER(TRIM(COALESCE(pm.Status, ''))) IN ('completed', 'done', 'closed')");
  }

  return { whereClause: conditions.join(' AND '), params };
};

const fetchCustomerName = async (customerId) => {
  if (!customerId) return '';
  try {
    const [customer] = await pool.execute(
      'SELECT Customer_Name FROM CUSTOMER WHERE Customer_Name = ? OR Customer_Ref_Number = ? OR Customer_ID = ? LIMIT 1',
      [customerId, customerId, customerId]
    );
    return customer?.[0]?.Customer_Name || '';
  } catch (error) {
    console.warn('Could not fetch customer name:', error.message);
    return '';
  }
};

const fetchReportDataset = async ({ start, end, customerId, projectId, completedOnly = false }) => {
  const { whereClause, params } = buildWhereClause(start, end, customerId, projectId, completedOnly);

  const statusQuery = `
    SELECT
      COALESCE(NULLIF(TRIM(pm.Status), ''), 'Unknown') as status,
      COUNT(*) as count
    FROM PMAINTENANCE pm
    LEFT JOIN ASSET a ON pm.Asset_ID = a.Asset_ID
    LEFT JOIN INVENTORY i ON a.Asset_ID = i.Asset_ID
    LEFT JOIN CUSTOMER c ON i.Customer_ID = c.Customer_ID
    WHERE ${whereClause}
    GROUP BY COALESCE(NULLIF(TRIM(pm.Status), ''), 'Unknown')
    ORDER BY count DESC
  `;

  const assetsQuery = `
    SELECT COUNT(DISTINCT pm.Asset_ID) as totalAssets
    FROM PMAINTENANCE pm
    LEFT JOIN ASSET a ON pm.Asset_ID = a.Asset_ID
    LEFT JOIN INVENTORY i ON a.Asset_ID = i.Asset_ID
    LEFT JOIN CUSTOMER c ON i.Customer_ID = c.Customer_ID
    WHERE ${whereClause}
  `;

  const recordsQuery = `
    SELECT
      pm.PM_ID,
      pm.Asset_ID,
      pm.PM_Date,
      pm.Remarks,
      pm.Status,
      pm.signature_path,
      pm.file_path_acknowledgement,
      a.Asset_Tag_ID,
      a.Item_Name,
      a.Asset_Serial_Number,
      cat.Category,
      p.Project_ID,
      p.Project_Ref_Number,
      p.Project_Title,
      c.Customer_ID,
      c.Customer_Name
    FROM PMAINTENANCE pm
    LEFT JOIN ASSET a ON pm.Asset_ID = a.Asset_ID
    LEFT JOIN CATEGORY cat ON a.Category_ID = cat.Category_ID
    LEFT JOIN INVENTORY i ON a.Asset_ID = i.Asset_ID
    LEFT JOIN PROJECT p ON i.Project_ID = p.Project_ID
    LEFT JOIN CUSTOMER c ON i.Customer_ID = c.Customer_ID
    WHERE ${whereClause}
    ORDER BY pm.PM_Date DESC
  `;

  const customerSummaryQuery = `
    SELECT
      COALESCE(c.Customer_Name, 'Unknown') as customer,
      COUNT(*) as total
    FROM PMAINTENANCE pm
    LEFT JOIN ASSET a ON pm.Asset_ID = a.Asset_ID
    LEFT JOIN INVENTORY i ON a.Asset_ID = i.Asset_ID
    LEFT JOIN CUSTOMER c ON i.Customer_ID = c.Customer_ID
    WHERE ${whereClause}
    GROUP BY COALESCE(c.Customer_Name, 'Unknown')
    ORDER BY total DESC
    LIMIT 10
  `;

  const projectSummaryQuery = `
    SELECT
      COALESCE(p.Project_Ref_Number, 'N/A') as projectRef,
      COALESCE(p.Project_Title, 'Unknown Project') as projectTitle,
      COUNT(*) as total
    FROM PMAINTENANCE pm
    LEFT JOIN ASSET a ON pm.Asset_ID = a.Asset_ID
    LEFT JOIN INVENTORY i ON a.Asset_ID = i.Asset_ID
    LEFT JOIN PROJECT p ON i.Project_ID = p.Project_ID
    LEFT JOIN CUSTOMER c ON i.Customer_ID = c.Customer_ID
    WHERE ${whereClause}
    GROUP BY COALESCE(p.Project_Ref_Number, 'N/A'), COALESCE(p.Project_Title, 'Unknown Project')
    ORDER BY total DESC
    LIMIT 10
  `;

  const [[statusRows], [assetRows], [records], [customerSummary], [projectSummary]] = await Promise.all([
    pool.execute(statusQuery, params),
    pool.execute(assetsQuery, params),
    pool.execute(recordsQuery, params),
    pool.execute(customerSummaryQuery, params),
    pool.execute(projectSummaryQuery, params)
  ]);

  const sequencedRecords = applyPmSequenceNumbers(records || []);

  const statusBreakdown = (statusRows || []).map((row) => ({
    status: row.status,
    count: normalizeNumber(row.count)
  }));

  const total = statusBreakdown.reduce((acc, item) => acc + item.count, 0);
  const completed = statusBreakdown
    .filter((item) => classifyStatus(item.status) === 'completed')
    .reduce((acc, item) => acc + item.count, 0);
  const unsigned = statusBreakdown
    .filter((item) => classifyStatus(item.status) === 'unsigned')
    .reduce((acc, item) => acc + item.count, 0);
  const incomplete = Math.max(total - completed - unsigned, 0);

  return {
    metrics: {
      total,
      completed,
      unsigned,
      incomplete,
      totalAssets: normalizeNumber(assetRows?.[0]?.totalAssets)
    },
      records: sequencedRecords,
    statusBreakdown,
    customerSummary: (customerSummary || []).map((r) => ({
      customer: r.customer,
      total: normalizeNumber(r.total)
    })),
    projectSummary: (projectSummary || []).map((r) => ({
      projectRef: r.projectRef,
      projectTitle: r.projectTitle,
      total: normalizeNumber(r.total)
    }))
  };
};

// Get PM report data (on-demand)
const generatePMReport = async (req, res) => {
  try {
    const { reportType, customerId, projectId, startDate, endDate, dateRange, completedOnly = false } = req.body;
    const { start, end } = getDateRange(startDate, endDate, dateRange);

    const customerName = await fetchCustomerName(customerId);
    const dataset = await fetchReportDataset({ start, end, customerId, projectId, completedOnly });
    const allPmRecords = dataset.records.map((record) => ({
      PM_ID: record.PM_ID,
      PM_Sequence: Number(record.PM_Sequence) || 1,
      signature_path: record.signature_path || null,
      file_path_acknowledgement: record.file_path_acknowledgement || null,
      Status: record.Status || 'Unknown'
    }));

    res.json({
      period: getPeriodLabel(dateRange, startDate, endDate, start, end),
      customerName,
      reportType,
      metrics: dataset.metrics,
      statusBreakdown: dataset.statusBreakdown,
      customerSummary: dataset.customerSummary,
      projectSummary: dataset.projectSummary,
      allPmIds: dataset.records.map((record) => record.PM_ID),
      allPmRecords,
      records: reportType === 'summary' || reportType === 'metrics' ? dataset.records.slice(0, 20) : dataset.records
    });
  } catch (error) {
    console.error('Error generating PM report:', error);
    res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
};

// Download PM report as Excel
const downloadPMReport = async (req, res) => {
  try {
    const { reportType, customerId, projectId, startDate, endDate, dateRange, completedOnly = false } = req.body;
    const { start, end } = getDateRange(startDate, endDate, dateRange);
    const customerName = await fetchCustomerName(customerId);
    const dataset = await fetchReportDataset({ start, end, customerId, projectId, completedOnly });
    const periodLabel = getPeriodLabel(dateRange, startDate, endDate, start, end);
    const completionRate = dataset.metrics.total > 0
      ? `${Math.round((dataset.metrics.completed / dataset.metrics.total) * 100)}%`
      : '0%';

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Inventra';
    workbook.created = new Date();
    
    // Management summary sheet
    const summarySheet = workbook.addWorksheet('Management Summary', { properties: { tabColor: '2E86DE' } });
    summarySheet.columns = [
      { key: 'a', width: 26 },
      { key: 'b', width: 26 },
      { key: 'c', width: 26 },
      { key: 'd', width: 26 }
    ];

    summarySheet.mergeCells('A1:D1');
    summarySheet.getCell('A1').value = 'Preventive Maintenance Report';
    summarySheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    summarySheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };
    summarySheet.getRow(1).height = 26;

    summarySheet.getCell('A3').value = 'Generated On';
    summarySheet.getCell('B3').value = new Date().toLocaleString();
    summarySheet.getCell('A4').value = 'Report Type';
    summarySheet.getCell('B4').value = reportType;
    summarySheet.getCell('A5').value = 'Period';
    summarySheet.getCell('B5').value = periodLabel;
    summarySheet.getCell('A6').value = 'Customer';
    summarySheet.getCell('B6').value = customerName || 'All Customers';

    ['A3', 'A4', 'A5', 'A6'].forEach((cell) => {
      summarySheet.getCell(cell).font = { bold: true, color: { argb: '1F4E78' } };
    });

    summarySheet.getCell('A8').value = 'Key Metrics';
    summarySheet.getCell('A8').font = { bold: true, size: 12, color: { argb: '1F4E78' } };

    summarySheet.getRow(9).values = ['Metric', 'Value', 'Metric', 'Value'];
    summarySheet.getRow(9).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ['A9', 'B9', 'C9', 'D9'].forEach((cell) => {
      summarySheet.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E86DE' } };
      summarySheet.getCell(cell).alignment = { horizontal: 'center' };
    });

    summarySheet.getRow(10).values = ['Total PM Records', dataset.metrics.total, 'Completed', dataset.metrics.completed];
    summarySheet.getRow(11).values = ['Unsigned', dataset.metrics.unsigned, 'Incomplete', dataset.metrics.incomplete];
    summarySheet.getRow(12).values = ['Assets Covered', dataset.metrics.totalAssets, 'Completion Rate', completionRate];

    for (let row = 10; row <= 12; row += 1) {
      ['A', 'B', 'C', 'D'].forEach((col) => {
        summarySheet.getCell(`${col}${row}`).border = {
          top: { style: 'thin', color: { argb: 'D6EAF8' } },
          left: { style: 'thin', color: { argb: 'D6EAF8' } },
          bottom: { style: 'thin', color: { argb: 'D6EAF8' } },
          right: { style: 'thin', color: { argb: 'D6EAF8' } }
        };
      });
    }

    summarySheet.getCell('A14').value = 'Status Breakdown';
    summarySheet.getCell('A14').font = { bold: true, size: 12, color: { argb: '1F4E78' } };
    summarySheet.getRow(15).values = ['Status', 'Count', '', ''];
    summarySheet.getRow(15).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getCell('A15').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E86DE' } };
    summarySheet.getCell('B15').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E86DE' } };

    let statusRow = 16;
    if (dataset.statusBreakdown.length === 0) {
      summarySheet.getCell(`A${statusRow}`).value = 'No records found for selected filters';
      summarySheet.mergeCells(`A${statusRow}:B${statusRow}`);
      statusRow += 1;
    } else {
      dataset.statusBreakdown.forEach((item) => {
        summarySheet.getCell(`A${statusRow}`).value = item.status;
        summarySheet.getCell(`B${statusRow}`).value = item.count;
        statusRow += 1;
      });
    }

    const customerHeaderRow = statusRow + 1;
    summarySheet.getCell(`A${customerHeaderRow}`).value = 'Top Customers';
    summarySheet.getCell(`A${customerHeaderRow}`).font = { bold: true, size: 12, color: { argb: '1F4E78' } };
    summarySheet.getRow(customerHeaderRow + 1).values = ['Customer', 'PM Count', '', ''];
    summarySheet.getRow(customerHeaderRow + 1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getCell(`A${customerHeaderRow + 1}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E86DE' } };
    summarySheet.getCell(`B${customerHeaderRow + 1}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E86DE' } };

    let customerRow = customerHeaderRow + 2;
    if (dataset.customerSummary.length === 0) {
      summarySheet.getCell(`A${customerRow}`).value = 'No customer data';
      summarySheet.mergeCells(`A${customerRow}:B${customerRow}`);
      customerRow += 1;
    } else {
      dataset.customerSummary.forEach((item) => {
        summarySheet.getCell(`A${customerRow}`).value = item.customer;
        summarySheet.getCell(`B${customerRow}`).value = item.total;
        customerRow += 1;
      });
    }

    const projectHeaderRow = customerRow + 1;
    summarySheet.getCell(`A${projectHeaderRow}`).value = 'Top Projects';
    summarySheet.getCell(`A${projectHeaderRow}`).font = { bold: true, size: 12, color: { argb: '1F4E78' } };
    summarySheet.getRow(projectHeaderRow + 1).values = ['Project Ref', 'Project Title', 'PM Count', ''];
    summarySheet.getRow(projectHeaderRow + 1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ['A', 'B', 'C'].forEach((col) => {
      summarySheet.getCell(`${col}${projectHeaderRow + 1}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '2E86DE' }
      };
    });

    let projectRow = projectHeaderRow + 2;
    if (dataset.projectSummary.length === 0) {
      summarySheet.getCell(`A${projectRow}`).value = 'No project data';
      summarySheet.mergeCells(`A${projectRow}:C${projectRow}`);
    } else {
      dataset.projectSummary.forEach((item) => {
        summarySheet.getCell(`A${projectRow}`).value = item.projectRef;
        summarySheet.getCell(`B${projectRow}`).value = item.projectTitle;
        summarySheet.getCell(`C${projectRow}`).value = item.total;
        projectRow += 1;
      });
    }

    // Details sheet
    const detailsSheet = workbook.addWorksheet('Detailed Records', { properties: { tabColor: '0B5345' } });

    detailsSheet.columns = [
      { header: 'PM ID', key: 'PM_ID', width: 12 },
      { header: 'Asset Tag', key: 'Asset_Tag_ID', width: 12 },
      { header: 'Asset Serial', key: 'Asset_Serial_Number', width: 15 },
      { header: 'Item Name', key: 'Item_Name', width: 20 },
      { header: 'Category', key: 'Category', width: 15 },
      { header: 'Customer', key: 'Customer_Name', width: 20 },
      { header: 'Project', key: 'Project_Ref_Number', width: 12 },
      { header: 'PM Date', key: 'PM_Date', width: 12 },
      { header: 'Status', key: 'Status', width: 12 },
      { header: 'Remarks', key: 'Remarks', width: 30 }
    ];

    // Add header styling
    detailsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    detailsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };
    detailsSheet.autoFilter = {
      from: 'A1',
      to: 'J1'
    };

    // Add data rows
    if (dataset.records && dataset.records.length > 0) {
      dataset.records.forEach((record) => {
        detailsSheet.addRow({
          PM_ID: record.PM_ID,
          Asset_Tag_ID: record.Asset_Tag_ID || '-',
          Asset_Serial_Number: record.Asset_Serial_Number || '-',
          Item_Name: record.Item_Name || '-',
          Category: record.Category || '-',
          Customer_Name: record.Customer_Name || '-',
          Project_Ref_Number: record.Project_Ref_Number || '-',
          PM_Date: record.PM_Date ? new Date(record.PM_Date).toLocaleDateString() : '-',
          Status: record.Status || '-',
          Remarks: record.Remarks || '-'
        });
      });
    } else {
      detailsSheet.addRow({
        PM_ID: '-',
        Asset_Tag_ID: '-',
        Asset_Serial_Number: '-',
        Item_Name: 'No records found for selected filters',
        Category: '-',
        Customer_Name: '-',
        Project_Ref_Number: '-',
        PM_Date: '-',
        Status: '-',
        Remarks: '-'
      });
    }

    // Set column widths to fit content
    detailsSheet.columns.forEach((column) => {
      column.width = Math.min(column.width || 15, 50);
    });

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();

    // Send response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="PM-Report-${new Date().getTime()}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error downloading PM report:', error);
    res.status(500).json({ error: 'Failed to download report', details: error.message });
  }
};

// Get PM Statistics for dashboard
const getPMReportStatistics = async (req, res) => {
  try {
    const dataset = await fetchReportDataset({ start: null, end: null, customerId: null, projectId: null });
    res.json({
      total: dataset.metrics.total,
      completed: dataset.metrics.completed,
      unsigned: dataset.metrics.unsigned,
      incomplete: dataset.metrics.incomplete,
      assetsCovered: dataset.metrics.totalAssets
    });
  } catch (error) {
    console.error('Error fetching PM statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

// Helper function to calculate date range
function getDateRange(startDate, endDate, dateRange) {
  const now = new Date();
  let start, end;

  switch (dateRange) {
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'range':
      start = startDate ? new Date(startDate) : null;
      end = endDate ? new Date(endDate) : null;
      break;
    case 'contractToDate':
      start = null;
      end = now;
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  // Format as YYYY-MM-DD
  const formatDate = (date) => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    start: formatDate(start),
    end: formatDate(end)
  };
}

module.exports = {
  generatePMReport,
  downloadPMReport,
  getPMReportStatistics
};
