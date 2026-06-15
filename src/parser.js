import * as XLSX from 'xlsx';

export function tratarRelatorioAfi(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  const termosSujeira = /GOVERNO|Unidade|Relação|Página|Gestão\s*:|Dados\s*Acumulados/i;
  const dfClean = rows.filter(row => {
    if (!row || row.length === 0) return false;
    const col0Str = String(row[0] || "");
    return !termosSujeira.test(col0Str);
  });
  
  let inicioDados = 0;
  let encontrou = false;
  for (let i = 0; i < dfClean.length; i++) {
    const rowStr = String(dfClean[i][0] || "");
    if (rowStr.includes("Número NE") || rowStr.includes("Data Emis")) {
      inicioDados = i + 2;
      encontrou = true;
      break;
    }
  }
  
  const dfDados = encontrou ? dfClean.slice(inicioDados) : dfClean;
  const numRows = dfDados.length - (dfDados.length % 2);
  const dfDadosEven = dfDados.slice(0, numRows);
  
  const records = [];
  
  for (let i = 0; i < numRows; i += 2) {
    const rowPar = dfDadosEven[i];
    const rowImpar = dfDadosEven[i + 1];
    
    const numNe = String(rowPar[0] || "").trim();
    const credor = String(rowPar[1] || "Sem Credor").trim();
    const processo = String(rowPar[8] || "").trim();
    
    const dataEmis = String(rowImpar[0] || "").trim();
    const uo = String(rowImpar[1] || "").trim();
    const pt = String(rowImpar[2] || "").trim();
    const fonte = String(rowImpar[4] || "").trim();
    const natureza = String(rowImpar[6] || "").trim();
    
    const parseVal = (val) => {
      if (val === undefined || val === null) return 0.0;
      if (typeof val === 'number') return val;
      const clean = String(val)
        .replace(/R\$/g, '')
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(/,/g, '.');
      const num = parseFloat(clean);
      return isNaN(num) ? 0.0 : num;
    };
    
    const empMes = parseVal(rowImpar[9]);
    const empAcum = parseVal(rowImpar[11]);
    const liqMes = parseVal(rowImpar[14]);
    const liqAcum = parseVal(rowImpar[17]);
    const aLiquidar = parseVal(rowImpar[21]);
    const pagoMes = parseVal(rowImpar[24]);
    const pagoAcum = parseVal(rowImpar[26]);
    const aPagar = parseVal(rowImpar[29]);
    
    let anoProcesso = "Sem Ano";
    const processoUpper = processo.toUpperCase();
    if (processoUpper.includes("FOLHA DE PAGAMENTO") || processoUpper.includes("FOLHA")) {
      anoProcesso = "2026";
    } else {
      const match = processo.match(/\b(20\d{2}|19\d{2})\b/);
      if (match) {
        anoProcesso = match[1];
      } else if (processo.length >= 4) {
        const last4 = processo.substring(processo.length - 4);
        if (/^\d{4}$/.test(last4)) {
          anoProcesso = last4;
        }
      }
    }
    
    if (anoProcesso === "0004" || anoProcesso === "Sem Ano") {
      anoProcesso = "2026";
    }
    
    if (numNe && numNe !== "undefined") {
      records.push({
        Num_NE: numNe,
        Credor: credor,
        Processo: processo,
        Data_Emis: dataEmis,
        UO: uo,
        PT: pt,
        Fonte: fonte,
        Natureza: natureza,
        Emp_Mes: empMes,
        Emp_Acum: empAcum,
        Liq_Mes: liqMes,
        Liq_Acum: liqAcum,
        A_Liquidar: aLiquidar,
        Pago_Mes: pagoMes,
        Pago_Acum: pagoAcum,
        A_Pagar: aPagar,
        Ano_Processo: anoProcesso
      });
    }
  }
  
  return records;
}
