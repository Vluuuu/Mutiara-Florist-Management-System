<?php

namespace App\Services\Excel;

use ZipArchive;

class SimpleXlsxExporter
{
    /**
     * @var array<string, array{headers: array<int, string>, rows: array<int, array<int, array{type: string, value: mixed, style?: int}>>, colWidths?: array<int, int>}>
     */
    protected array $sheets = [];

    /**
     * Sanitizes text to prevent spreadsheet formula injection.
     * Characters =, +, -, @, \t, \r at the beginning are prefixed with a single quote.
     */
    public static function sanitizeText(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        $trimmed = ltrim($value);
        if ($trimmed !== '' && in_array($trimmed[0], ['=', '+', '-', '@', "\t", "\r"], true)) {
            return "'".$value;
        }

        return $value;
    }

    /**
     * XML entities escaping.
     */
    public static function xmlEscape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    /**
     * Add a sheet with title and data rows.
     *
     * @param string $title
     * @param array<int, array<int, array{type: string, value: mixed, style?: int}>> $rows
     * @param array<int, int>|null $colWidths
     */
    public function addSheet(string $title, array $rows, ?array $colWidths = null): self
    {
        // Sheet title must be <= 31 chars and cannot contain: \ / ? * : [ ]
        $cleanTitle = substr(preg_replace('/[\\\\\\/?*:\[\]]/', '', $title) ?: 'Sheet', 0, 31);
        $this->sheets[$cleanTitle] = [
            'rows' => $rows,
            'colWidths' => $colWidths ?? [],
        ];

        return $this;
    }

    /**
     * Builds and saves the XLSX file to a given target path.
     */
    public function save(string $outputPath): bool
    {
        $dir = dirname($outputPath);
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $zip = new ZipArchive();
        if ($zip->open($outputPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            return false;
        }

        // 1. [Content_Types].xml
        $contentTypesXml = $this->buildContentTypesXml();
        $zip->addFromString('[Content_Types].xml', $contentTypesXml);

        // 2. _rels/.rels
        $relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            .'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            .'</Relationships>';
        $zip->addFromString('_rels/.rels', $relsXml);

        // 3. xl/_rels/workbook.xml.rels
        $workbookRelsXml = $this->buildWorkbookRelsXml();
        $zip->addFromString('xl/_rels/workbook.xml.rels', $workbookRelsXml);

        // 4. xl/workbook.xml
        $workbookXml = $this->buildWorkbookXml();
        $zip->addFromString('xl/workbook.xml', $workbookXml);

        // 5. xl/styles.xml
        $stylesXml = $this->buildStylesXml();
        $zip->addFromString('xl/styles.xml', $stylesXml);

        // 6. Worksheets
        $sheetIndex = 1;
        foreach ($this->sheets as $sheetData) {
            $sheetXml = $this->buildWorksheetXml($sheetData['rows'], $sheetData['colWidths']);
            $zip->addFromString("xl/worksheets/sheet{$sheetIndex}.xml", $sheetXml);
            $sheetIndex++;
        }

        return $zip->close();
    }

    protected function buildContentTypesXml(): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Types xmlns="http://schemas.openxmlformats.org/package/2006/types">'
            .'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            .'<Default Extension="xml" ContentType="application/xml"/>'
            .'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            .'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';

        $sheetIndex = 1;
        foreach ($this->sheets as $ignored) {
            $xml .= '<Override PartName="/xl/worksheets/sheet'.$sheetIndex.'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
            $sheetIndex++;
        }

        $xml .= '</Types>';

        return $xml;
    }

    protected function buildWorkbookRelsXml(): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';

        $sheetIndex = 1;
        foreach ($this->sheets as $ignored) {
            $xml .= '<Relationship Id="rId'.$sheetIndex.'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'.$sheetIndex.'.xml"/>';
            $sheetIndex++;
        }

        // Styles rel
        $xml .= '<Relationship Id="rId'.($sheetIndex).'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
        $xml .= '</Relationships>';

        return $xml;
    }

    protected function buildWorkbookXml(): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            .'<sheets>';

        $sheetIndex = 1;
        foreach (array_keys($this->sheets) as $name) {
            $safeName = self::xmlEscape($name);
            $xml .= '<sheet name="'.$safeName.'" sheetId="'.$sheetIndex.'" r:id="rId'.$sheetIndex.'"/>';
            $sheetIndex++;
        }

        $xml .= '</sheets></workbook>';

        return $xml;
    }

    /**
     * Styles configuration:
     * 0: Normal
     * 1: Title (Bold 14pt)
     * 2: Subtitle (10pt, Muted)
     * 3: Table Header (Bold, Emerald 900 #064E3B, White text, centered)
     * 4: Date Cell (Centered, thin border)
     * 5: Currency Cell (Right aligned, thin border, format Rp #,##0)
     * 6: Integer Cell (Right aligned, thin border, format #,##0)
     * 7: Text Cell (Left aligned, thin border)
     * 8: Text Cell Centered (thin border)
     * 9: Bold Text Cell (thin border)
     * 10: Bold Currency Cell (Right aligned, thin border, bold, format Rp #,##0)
     * 11: Note / Disclaimer Text (italic, muted, wrapText)
     */
    protected function buildStylesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            .'<numFmts count="2">'
            .'<numFmt numFmtId="164" formatCode="&quot;Rp&quot;\ #,##0"/>'
            .'<numFmt numFmtId="165" formatCode="yyyy-mm-dd"/>'
            .'</numFmts>'
            .'<fonts count="5">'
            .'<font><sz val="10"/><name val="Arial"/></font>' // 0: regular
            .'<font><b/><sz val="10"/><name val="Arial"/></font>' // 1: bold
            .'<font><b/><sz val="14"/><color rgb="FF064E3B"/><name val="Arial"/></font>' // 2: title
            .'<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>' // 3: header white
            .'<font><i/><sz val="9"/><color rgb="FF6B7280"/><name val="Arial"/></font>' // 4: italic muted
            .'</fonts>'
            .'<fills count="4">'
            .'<fill><patternFill patternType="none"/></fill>' // 0
            .'<fill><patternFill patternType="gray125"/></fill>' // 1
            .'<fill><patternFill patternType="solid"><fgColor rgb="FF064E3B"/></patternFill></fill>' // 2: Emerald 900
            .'<fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/></patternFill></fill>' // 3: Light gray
            .'</fills>'
            .'<borders count="2">'
            .'<border><left/><right/><top/><bottom/><diagonal/></border>' // 0: none
            .'<border>' // 1: thin
            .'<left style="thin"><color rgb="FFD1D5DB"/></left>'
            .'<right style="thin"><color rgb="FFD1D5DB"/></right>'
            .'<top style="thin"><color rgb="FFD1D5DB"/></top>'
            .'<bottom style="thin"><color rgb="FFD1D5DB"/></bottom>'
            .'</border>'
            .'</borders>'
            .'<cellStyleXfs count="1">'
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>'
            .'</cellStyleXfs>'
            .'<cellXfs count="12">'
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' // 0: normal
            .'<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>' // 1: title
            .'<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0"/>' // 2: subtitle
            .'<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' // 3: table header
            .'<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' // 4: date
            .'<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' // 5: currency
            .'<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' // 6: integer
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>' // 7: text
            .'<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' // 8: text center
            .'<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>' // 9: bold text
            .'<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' // 10: bold currency
            .'<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1"/></xf>' // 11: note/disclaimer
            .'</cellXfs>'
            .'</styleSheet>';
    }

    /**
     * @param array<int, array<int, array{type: string, value: mixed, style?: int}>> $rows
     * @param array<int, int> $colWidths
     */
    protected function buildWorksheetXml(array $rows, array $colWidths): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            .'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

        // Column widths
        if (! empty($colWidths)) {
            $xml .= '<cols>';
            $colIndex = 1;
            foreach ($colWidths as $w) {
                $xml .= '<col min="'.$colIndex.'" max="'.$colIndex.'" width="'.$w.'" customWidth="1"/>';
                $colIndex++;
            }
            $xml .= '</cols>';
        }

        $xml .= '<sheetData>';

        $rowIndex = 1;
        foreach ($rows as $row) {
            $xml .= '<row r="'.$rowIndex.'">';
            $colIndex = 1;
            foreach ($row as $cell) {
                $cellRef = $this->getColumnLetter($colIndex).$rowIndex;
                $styleAttr = isset($cell['style']) ? ' s="'.$cell['style'].'"' : '';

                $type = $cell['type'] ?? 'string';
                $val = $cell['value'] ?? '';

                if ($type === 'number' || $type === 'currency' || $type === 'integer') {
                    $numericVal = is_numeric($val) ? $val : 0;
                    $xml .= '<c r="'.$cellRef.'"'.$styleAttr.' t="n"><v>'.$numericVal.'</v></c>';
                } else {
                    // String / text - sanitize and XML escape
                    $strVal = self::xmlEscape(self::sanitizeText((string) $val));
                    $xml .= '<c r="'.$cellRef.'"'.$styleAttr.' t="inlineStr"><is><t>'.$strVal.'</t></is></c>';
                }

                $colIndex++;
            }
            $xml .= '</row>';
            $rowIndex++;
        }

        $xml .= '</sheetData></worksheet>';

        return $xml;
    }

    /**
     * Converts a 1-based column number to Excel column letter (e.g. 1 -> A, 27 -> AA).
     */
    protected function getColumnLetter(int $colIndex): string
    {
        $letter = '';
        while ($colIndex > 0) {
            $rem = ($colIndex - 1) % 26;
            $letter = chr(65 + $rem).$letter;
            $colIndex = (int) (($colIndex - $rem) / 26);
        }

        return $letter;
    }
}
