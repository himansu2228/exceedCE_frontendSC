import * as XLSX from 'xlsx-js-style'

type Worksheet = ReturnType<typeof XLSX.utils.aoa_to_sheet>

const colors = {
  navy: '1F4E78',
  blue: '5B9BD5',
  lightBlue: 'EAF3F8',
  white: 'FFFFFF',
  ink: '243746',
  border: 'D5DEE7',
  total: 'DCE6F1',
}

function setCellStyle(worksheet: Worksheet, row: number, column: number, style: Record<string, unknown>) {
  const address = XLSX.utils.encode_cell({ r: row, c: column })
  if (!worksheet[address]) worksheet[address] = { t: 's', v: '' }
  worksheet[address].s = { ...(worksheet[address].s || {}), ...style }
}

function setRowStyle(worksheet: Worksheet, row: number, lastColumn: number, style: Record<string, unknown>) {
  for (let column = 0; column <= lastColumn; column += 1) setCellStyle(worksheet, row, column, style)
}

export function formatDataWorksheet(
  worksheet: Worksheet,
  options: {
    headerRow: number
    dataEndRow: number
    totalRow?: number
    titleRow?: number
    columnWidths: number[]
    currencyColumns?: number[]
  }
) {
  const lastColumn = options.columnWidths.length - 1

  if (options.titleRow !== undefined) {
    setRowStyle(worksheet, options.titleRow, lastColumn, {
      fill: { patternType: 'solid', fgColor: { rgb: colors.navy } },
      font: { name: 'Aptos Display', sz: 16, bold: true, color: { rgb: colors.white } },
      alignment: { vertical: 'center' },
    })
    worksheet['!merges'] = [...(worksheet['!merges'] || []), {
      s: { r: options.titleRow, c: 0 }, e: { r: options.titleRow, c: lastColumn },
    }]
    worksheet['!rows'] = worksheet['!rows'] || []
    worksheet['!rows'][options.titleRow] = { hpt: 30 }
  }

  setRowStyle(worksheet, options.headerRow, lastColumn, {
    fill: { patternType: 'solid', fgColor: { rgb: colors.blue } },
    font: { name: 'Aptos', sz: 10, bold: true, color: { rgb: colors.white } },
    alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
    border: { bottom: { style: 'medium', color: { rgb: colors.navy } } },
  })
  worksheet['!rows'] = worksheet['!rows'] || []
  worksheet['!rows'][options.headerRow] = { hpt: 28 }

  for (let row = options.headerRow + 1; row <= options.dataEndRow; row += 1) {
    setRowStyle(worksheet, row, lastColumn, {
      font: { name: 'Aptos', sz: 10, color: { rgb: colors.ink } },
      alignment: { vertical: 'center', wrapText: true },
      border: { bottom: { style: 'thin', color: { rgb: colors.border } } },
      ...(row % 2 === 0 ? { fill: { patternType: 'solid', fgColor: { rgb: colors.lightBlue } } } : {}),
    })
    for (const column of options.currencyColumns || []) {
      const address = XLSX.utils.encode_cell({ r: row, c: column })
      if (worksheet[address]?.t === 'n') worksheet[address].z = '$#,##0.00;[Red]-$#,##0.00'
    }
  }

  if (options.totalRow !== undefined) {
    setRowStyle(worksheet, options.totalRow, lastColumn, {
      fill: { patternType: 'solid', fgColor: { rgb: colors.total } },
      font: { name: 'Aptos', sz: 10, bold: true, color: { rgb: colors.navy } },
      border: { top: { style: 'medium', color: { rgb: colors.blue } } },
    })
  }

  worksheet['!cols'] = options.columnWidths.map((wch) => ({ wch }))
  if (options.dataEndRow > options.headerRow) {
    worksheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: options.headerRow, c: 0 },
        e: { r: options.dataEndRow, c: lastColumn },
      }),
    }
  }
}
