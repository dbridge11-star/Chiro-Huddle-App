/**
 * Excel Export Utilities
 * Creates Excel-compatible files with accumulated history tracking
 * Supports 7 categories for Evening Huddle
 */

const ExcelExporter = {
    // File names for trackers (consistent names for accumulation)
    TRACKER_FILES: {
        pmtIssues: 'PMT_Issues.xlsx',
        insuranceQuestions: 'Insurance_Questions.xlsx',
        noAppt: 'No_Appt.xlsx',
        chargePassdown: 'Charge_and_Passdown.xlsx',
        todo24: '24_Hour_ToDo.xlsx',
        chiro180: 'Chiro180_Updates.xlsx',
        insuranceVerify: 'Insurance_Verification.xlsx'
    },

    // Category labels
    CATEGORY_LABELS: {
        pmtIssues: 'PMT Issue',
        insuranceQuestions: 'Insurance Question',
        noAppt: 'No Appointment',
        chargePassdown: 'Charge/Passdown',
        todo24: '24 Hour To-Do',
        chiro180: 'Chiro 180 Update',
        insuranceVerify: 'Insurance Verification'
    },

    // Headers for each section type
    HEADERS: {
        pmtIssues: ['Date', 'Patient Name', 'Issue', 'Notes', 'Timestamp'],
        insuranceQuestions: ['Date', 'Patient Name', 'Question/Issue', 'Notes', 'Timestamp'],
        noAppt: ['Date', 'Patient Name', 'Reason', 'Notes', 'Timestamp'],
        chargePassdown: ['Date', 'Patient Name', 'Charge Codes', 'Notes', 'Timestamp'],
        todo24: ['Date', 'Task', 'Timestamp'],
        chiro180: ['Date', 'Patient Name', 'Status', 'Timestamp'],
        insuranceVerify: ['Date', 'Patient Name', 'Status', 'Timestamp']
    },

    // Escape XML special characters
    escapeXml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    },

    // Create Excel XML workbook
    createWorkbook(sheetName, headers, rows) {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
    <Styles>
        <Style ss:ID="Header">
            <Font ss:Bold="1" ss:Size="12" ss:Color="#FFFFFF"/>
            <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
            <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
        </Style>
        <Style ss:ID="Date">
            <NumberFormat ss:Format="yyyy-mm-dd"/>
        </Style>
        <Style ss:ID="DateTime">
            <NumberFormat ss:Format="yyyy-mm-dd hh:mm"/>
        </Style>
        <Style ss:ID="Alt">
            <Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/>
        </Style>
    </Styles>
    <Worksheet ss:Name="${this.escapeXml(sheetName)}">
        <Table>`;

        // Column widths
        const widths = headers.map(() => 150);
        widths.forEach(w => {
            xml += `<Column ss:AutoFitWidth="1" ss:Width="${w}"/>`;
        });

        // Header row
        xml += `<Row ss:StyleID="Header" ss:Height="25">`;
        headers.forEach(header => {
            xml += `<Cell><Data ss:Type="String">${this.escapeXml(header)}</Data></Cell>`;
        });
        xml += `</Row>`;

        // Data rows (sorted by date descending - newest first)
        rows.sort((a, b) => {
            const dateA = new Date(a[a.length - 1] || a[0]); // timestamp or date
            const dateB = new Date(b[b.length - 1] || b[0]);
            return dateB - dateA;
        });

        rows.forEach((row, idx) => {
            const styleAttr = idx % 2 === 1 ? ' ss:StyleID="Alt"' : '';
            xml += `<Row${styleAttr}>`;
            row.forEach((cell) => {
                xml += `<Cell><Data ss:Type="String">${this.escapeXml(cell)}</Data></Cell>`;
            });
            xml += `</Row>`;
        });

        xml += `</Table>
    </Worksheet>
</Workbook>`;

        return xml;
    },

    // ==================== UNIFIED EXPORT METHOD ====================

    // Export any section by type (with local download)
    async exportSection(sectionId, newItems, skipDownload = false) {
        let allItems = newItems; // Default to newItems

        // Try to add to and get from persistent storage
        try {
            await StorageManager.addToTrackerHistory(sectionId, newItems);
            const history = await StorageManager.getTrackerHistory(sectionId);
            if (history && history.length > 0) {
                allItems = history;
            }
        } catch (e) {
            console.warn('Could not access tracker history, using current items:', e);
        }

        // Convert items to rows based on section type
        const rows = this.convertToRows(sectionId, allItems);
        const headers = this.HEADERS[sectionId];
        const sheetName = this.CATEGORY_LABELS[sectionId].replace(/\//g, '_');

        const filename = this.TRACKER_FILES[sectionId];

        console.log(`Exporting ${sectionId}: ${allItems.length} items, ${rows.length} rows`);

        // Try to upload to Google Drive (as Google Sheets) if connected
        let driveResult = null;
        if (typeof GoogleDriveManager !== 'undefined' && GoogleDriveManager.isConnected()) {
            try {
                // Send JSON data for Google Sheets API
                const sheetData = JSON.stringify({
                    sheetName: sheetName,
                    headers: headers,
                    rows: rows
                });
                console.log('Sheet data being sent:', sheetData);
                driveResult = await GoogleDriveManager.uploadFile(filename, sheetData, sectionId);
            } catch (e) {
                console.error('Drive upload failed:', e);
            }
        }

        // Only download locally if not skipped (manual export triggers download, auto-export skips it)
        if (!skipDownload) {
            const xml = this.createWorkbook(sheetName, headers, rows);
            this.downloadFile(xml, filename);
        }

        return {
            newCount: newItems.length,
            totalCount: allItems.length,
            savedToDrive: !!driveResult
        };
    },

    // Silent export to Google Drive only (no download) - used for auto-sync
    async exportSectionToDrive(sectionId, newItems) {
        return this.exportSection(sectionId, newItems, true);
    },

    // Convert items to spreadsheet rows based on section type
    convertToRows(sectionId, items) {
        switch (sectionId) {
            case 'pmtIssues':
            case 'insuranceQuestions':
            case 'noAppt':
                return items.map(item => [
                    item.date || '',
                    item.patientName || '',
                    item.note || this.CATEGORY_LABELS[sectionId],
                    item.note || '',
                    this.formatTimestamp(item.timestamp)
                ]);

            case 'chargePassdown':
                return items.map(item => [
                    item.date || '',
                    item.patientName || '',
                    (item.codes || []).join(', '),
                    item.note || '',
                    this.formatTimestamp(item.timestamp)
                ]);

            case 'todo24':
                return items.map(item => [
                    item.date || '',
                    item.task || '',
                    this.formatTimestamp(item.timestamp)
                ]);

            case 'chiro180':
                return items.map(item => [
                    item.date || '',
                    item.patientName || '',
                    item.status === 'updated' ? 'Updated' : 'Needs Update',
                    this.formatTimestamp(item.timestamp)
                ]);

            case 'insuranceVerify':
                return items.map(item => [
                    item.date || '',
                    item.patientName || '',
                    'Needs Verification',
                    this.formatTimestamp(item.timestamp)
                ]);

            default:
                return items.map(item => [
                    item.date || '',
                    item.patientName || '',
                    item.note || '',
                    this.formatTimestamp(item.timestamp)
                ]);
        }
    },

    // Format timestamp for display
    formatTimestamp(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // ==================== FULL EXPORT ====================

    // Export all sections
    async exportAllSections(huddleData, patients) {
        const dateStamp = this.getDateStamp();

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
    xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns:x="urn:schemas-microsoft-com:office:excel"
    xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
    <Styles>
        <Style ss:ID="Header">
            <Font ss:Bold="1" ss:Size="12" ss:Color="#FFFFFF"/>
            <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
        </Style>
        <Style ss:ID="Alt">
            <Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/>
        </Style>
    </Styles>`;

        // Add each section as a worksheet
        const sectionIds = Object.keys(this.TRACKER_FILES);
        for (const sectionId of sectionIds) {
            const items = this.getSectionData(huddleData, sectionId);
            if (items.length > 0) {
                xml += this.createWorksheet(sectionId, items);
            }
        }

        // Patients Sheet
        xml += this.createPatientsSheet(patients);

        xml += `</Workbook>`;

        this.downloadFile(xml, `ChiroHuddle_FullExport_${dateStamp}.xlsx`);
    },

    // Get section data from huddle data
    getSectionData(huddleData, sectionId) {
        if (sectionId === 'chiro180') {
            return Object.entries(huddleData.chiro180 || {})
                .filter(([_, status]) => status !== 'pending')
                .map(([patient, status]) => ({
                    patientName: patient,
                    status: status,
                    date: huddleData.date,
                    timestamp: new Date().toISOString()
                }));
        } else if (sectionId === 'insuranceVerify') {
            return Object.entries(huddleData.insuranceVerify || {})
                .map(([patient, verified]) => ({
                    patientName: patient,
                    verified: verified,
                    date: huddleData.date,
                    timestamp: new Date().toISOString()
                }));
        } else {
            return huddleData[sectionId] || [];
        }
    },

    // Create a worksheet for a section
    createWorksheet(sectionId, items) {
        const sheetName = this.CATEGORY_LABELS[sectionId].replace(/\//g, '_');
        const headers = this.HEADERS[sectionId];
        const rows = this.convertToRows(sectionId, items);

        let xml = `<Worksheet ss:Name="${this.escapeXml(sheetName)}">
        <Table>`;

        // Column widths
        headers.forEach(() => {
            xml += `<Column ss:Width="150"/>`;
        });

        // Header row
        xml += `<Row ss:StyleID="Header">`;
        headers.forEach(header => {
            xml += `<Cell><Data ss:Type="String">${this.escapeXml(header)}</Data></Cell>`;
        });
        xml += `</Row>`;

        // Data rows
        rows.forEach((row, idx) => {
            const styleAttr = idx % 2 === 1 ? ' ss:StyleID="Alt"' : '';
            xml += `<Row${styleAttr}>`;
            row.forEach(cell => {
                xml += `<Cell><Data ss:Type="String">${this.escapeXml(cell)}</Data></Cell>`;
            });
            xml += `</Row>`;
        });

        xml += `</Table></Worksheet>`;
        return xml;
    },

    // Create patients sheet
    createPatientsSheet(patients) {
        let xml = `<Worksheet ss:Name="Patients">
        <Table>
            <Column ss:Width="200"/>
            <Row ss:StyleID="Header">
                <Cell><Data ss:Type="String">Patient Name</Data></Cell>
            </Row>`;

        if (Array.isArray(patients)) {
            patients.forEach((patient, idx) => {
                const styleAttr = idx % 2 === 1 ? ' ss:StyleID="Alt"' : '';
                xml += `<Row${styleAttr}>
                    <Cell><Data ss:Type="String">${this.escapeXml(patient)}</Data></Cell>
                </Row>`;
            });
        }

        xml += `</Table></Worksheet>`;
        return xml;
    },

    // Get date stamp for filename
    getDateStamp() {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    },

    // Download file
    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

// Make available globally
window.ExcelExporter = ExcelExporter;
