// Dados de exemplo realistas caso o Firestore esteja sem dados inicialmente.
// Permite que a tela apresente gráficos lindos logo de início.
export const mockOrcamentos = [
  {
    Num_NE: "2026NE00012",
    Credor: "CETAM - CONCURSOS PUBLICOS LTDA",
    Processo: "014234/2026",
    Data_Emis: "15/06/2026",
    UO: "CETAM",
    PT: "12.361.3190.2814",
    Fonte: "0101",
    Natureza: "339039 - OUTROS SERVIÇOS DE TERCEIROS - PJ",
    Emp_Mes: 150000.00,
    Emp_Acum: 450000.00,
    Liq_Mes: 120000.00,
    Liq_Acum: 320000.00,
    A_Liquidar: 130000.00,
    Pago_Mes: 100000.00,
    Pago_Acum: 300000.00,
    A_Pagar: 20000.00,
    Ano_Processo: "2026"
  },
  {
    Num_NE: "2026NE00015",
    Credor: "TELEFONICA BRASIL S.A.",
    Processo: "009412/2026",
    Data_Emis: "15/06/2026",
    UO: "CETAM",
    PT: "12.361.3190.2814",
    Fonte: "0100",
    Natureza: "339040 - SERVIÇOS DE TECNOLOGIA DA INFORMAÇÃO",
    Emp_Mes: 45000.00,
    Emp_Acum: 135000.00,
    Liq_Mes: 45000.00,
    Liq_Acum: 135000.00,
    A_Liquidar: 0.00,
    Pago_Mes: 45000.00,
    Pago_Acum: 90000.00,
    A_Pagar: 45000.00,
    Ano_Processo: "2026"
  },
  {
    Num_NE: "2026NE00045",
    Credor: "FOLHA DE PAGAMENTO - CETAM",
    Processo: "FOLHA DE PAGAMENTO",
    Data_Emis: "10/05/2026",
    UO: "CETAM",
    PT: "12.361.3190.2811",
    Fonte: "0100",
    Natureza: "319011 - VENCIMENTOS E VANTAGENS FIXAS - PESSOAL CIVIL",
    Emp_Mes: 850000.00,
    Emp_Acum: 4250000.00,
    Liq_Mes: 850000.00,
    Liq_Acum: 4250000.00,
    A_Liquidar: 0.00,
    Pago_Mes: 850000.00,
    Pago_Acum: 4250000.00,
    A_Pagar: 0.00,
    Ano_Processo: "2026"
  },
  {
    Num_NE: "2025NE00841",
    Credor: "AMAZONAS ENERGIA S.A.",
    Processo: "005112/2025",
    Data_Emis: "12/12/2025",
    UO: "CETAM",
    PT: "12.361.3190.2814",
    Fonte: "0100",
    Natureza: "339039 - OUTROS SERVIÇOS DE TERCEIROS - PJ",
    Emp_Mes: 0.00,
    Emp_Acum: 220000.00,
    Liq_Mes: 18000.00,
    Liq_Acum: 210000.00,
    A_Liquidar: 10000.00,
    Pago_Mes: 18000.00,
    Pago_Acum: 190000.00,
    A_Pagar: 20000.00,
    Ano_Processo: "2025"
  },
  {
    Num_NE: "2024NE00912",
    Credor: "CONSTRUTORA SOLIMOES LTDA",
    Processo: "004123/2024",
    Data_Emis: "08/10/2024",
    UO: "CETAM",
    PT: "12.361.3190.2815",
    Fonte: "0120",
    Natureza: "449051 - OBRAS E INSTALAÇÕES",
    Emp_Mes: 0.00,
    Emp_Acum: 1200000.00,
    Liq_Mes: 0.00,
    Liq_Acum: 1100000.00,
    A_Liquidar: 100000.00,
    Pago_Mes: 50000.00,
    Pago_Acum: 950000.00,
    A_Pagar: 150000.00,
    Ano_Processo: "2024"
  }
];

export const mockArquivos = [
  {
    nome_original: "relatorio_afi_junho_2026.xls",
    caminho_bruto: "bruto/relatorio_afi_junho_2026.xls",
    caminho_tratado: "tratado/relatorio_afi_junho_2026.xlsx",
    total_linhas: 120,
    processado_em: "15/06/2026 às 10:14",
    status: "sucesso"
  },
  {
    nome_original: "relatorio_afi_maio_2026.xls",
    caminho_bruto: "bruto/relatorio_afi_maio_2026.xls",
    caminho_tratado: "tratado/relatorio_maio_2026.xlsx",
    total_linhas: 98,
    processado_em: "10/05/2026 às 09:30",
    status: "sucesso"
  }
];
