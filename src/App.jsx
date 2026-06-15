import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, FunnelChart, Funnel 
} from 'recharts';
import { 
  LayoutDashboard, TrendingUp, AlertTriangle, Upload, Users, LogOut, Sun, Moon, Search, 
  Download, FileSpreadsheet, Plus, ShieldCheck, ChevronRight, FileDown, Eye, HelpCircle
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { mockOrcamentos, mockArquivos } from './mockData';

// Cores Curadas para Modo Escuro/Claro (Paleta HSL Violeta/Indico/Slate)
const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#e11d48', '#3b82f6', '#06b6d4', '#10b981'];

export default function App() {
  // Configurações Globais
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [user, setUser] = useState({
    email: 'lucivaldo586@gmail.com',
    name: 'Lucivaldo Braga',
    role: 'admin'
  });
  
  // Banco de Dados Local / Integrado
  const [dados, setDados] = useState(mockOrcamentos);
  const [arquivos, setArquivos] = useState(mockArquivos);
  const [usuariosAutorizados, setUsuariosAutorizados] = useState([
    { email: 'lucivaldo586@gmail.com', name: 'Lucivaldo Braga', role: 'admin' },
    { email: 'diretoria@cetam.am.gov.br', name: 'Diretoria Executiva', role: 'viewer' }
  ]);

  // Filtros de Pesquisa
  const [busca, setBusca] = useState('');
  const [filtroAno, setFiltroAno] = useState('Todos');
  const [filtroNatureza, setFiltroNatureza] = useState('Todos');
  const [filtroUO, setFiltroUO] = useState('Todos');
  
  // Form de Cadastro de Usuário
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoCargo, setNovoCargo] = useState('viewer');

  // Controle de Tema
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Restrição de Rede Futura (Comentário Estruturado)
  /* 
   * ==========================================
   * TODO: VALIDAÇÃO DE RESTRIÇÃO DE IP (INTRANET CETAM)
   * ==========================================
   * Para restringir o acesso futuramente apenas à Intranet/Rede Local do CETAM:
   * 1. No Cloud Functions backend (Python/Node):
   *    - Obter o IP do cliente a partir do header 'x-forwarded-for' ou request.remote_addr.
   *    - Validar se o IP pertence à faixa corporativa/VPN do CETAM (Ex: 10.0.0.0/8 ou IP público fixo).
   * 2. No Frontend React / Roteador:
   *    - Criar um Hook de validação (ex: useNetConfig) que consome um endpoint `/api/check-ip`.
   *    - Se o IP não for válido, renderizar uma tela de bloqueio e impedir carregamento do dashboard.
   */

  // Filtragem dos dados
  const dadosFiltrados = dados.filter(item => {
    const termo = busca.toLowerCase();
    const bateBusca = 
      item.Credor.toLowerCase().includes(termo) ||
      item.Num_NE.toLowerCase().includes(termo) ||
      item.Processo.toLowerCase().includes(termo) ||
      item.Natureza.toLowerCase().includes(termo) ||
      item.PT.toLowerCase().includes(termo) ||
      item.Fonte.toLowerCase().includes(termo) ||
      item.UO.toLowerCase().includes(termo);

    const bateAno = filtroAno === 'Todos' || item.Ano_Processo === filtroAno;
    const bateNatureza = filtroNatureza === 'Todos' || item.Natureza.includes(filtroNatureza);
    const bateUO = filtroUO === 'Todos' || item.UO === filtroUO;

    return bateBusca && bateAno && bateNatureza && bateUO;
  });

  // Lista única para preencher selects de filtros
  const anosDisponiveis = ['Todos', ...new Set(dados.map(item => item.Ano_Processo))];
  const naturezasDisponiveis = ['Todos', ...new Set(dados.map(item => item.Natureza.split(' - ')[0]))];
  const uosDisponiveis = ['Todos', ...new Set(dados.map(item => item.UO))];

  // Cálculos de KPIs
  const totais = dadosFiltrados.reduce((acc, curr) => {
    acc.empMes += curr.Emp_Mes;
    acc.empAcum += curr.Emp_Acum;
    acc.liqMes += curr.Liq_Mes;
    acc.liqAcum += curr.Liq_Acum;
    acc.aLiquidar += curr.A_Liquidar;
    acc.pagoMes += curr.Pago_Mes;
    acc.pagoAcum += curr.Pago_Acum;
    acc.aPagar += curr.A_Pagar;
    return acc;
  }, {
    empMes: 0, empAcum: 0, liqMes: 0, liqAcum: 0,
    aLiquidar: 0, pagoMes: 0, pagoAcum: 0, aPagar: 0
  });

  const percentualExecucao = totais.empAcum > 0 ? (totais.pagoAcum / totais.empAcum) * 100 : 0;

  // Empenhos agendados para hoje (simulados baseados na data atual 15/06/2026)
  const empenhosHoje = dadosFiltrados.filter(item => item.Data_Emis === '15/06/2026');
  const valorHoje = empenhosHoje.reduce((sum, item) => sum + item.Pago_Mes, 0);

  // Formatação monetária BRL
  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  // Exportação da Página Atual para PDF
  const exportarPDF = () => {
    const input = document.getElementById('dashboard-content');
    html2canvas(input, { scale: 2, useCORS: true }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`relatorio_orcamentario_${currentPage}.pdf`);
    });
  };

  // Exportação dos dados atuais para XLS (CSV simulando Excel com codificação UTF-8)
  const exportarXLS = () => {
    let csvContent = "\uFEFF"; // Garante acentuação correta no Excel brasileiro
    csvContent += "Num_NE;Credor;Processo;Data_Emis;UO;PT;Fonte;Natureza;Emp_Mes;Emp_Acum;Liq_Mes;Liq_Acum;A_Liquidar;Pago_Mes;Pago_Acum;A_Pagar;Ano_Processo\n";
    
    dadosFiltrados.forEach(row => {
      csvContent += `${row.Num_NE};${row.Credor};${row.Processo};${row.Data_Emis};${row.UO};${row.PT};${row.Fonte};${row.Natureza};${row.Emp_Mes};${row.Emp_Acum};${row.Liq_Mes};${row.Liq_Acum};${row.A_Liquidar};${row.Pago_Mes};${row.Pago_Acum};${row.A_Pagar};${row.Ano_Processo}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tabela_tratada_${new Date().toLocaleDateString('pt-BR')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Upload simulado de planilha
  const handleUploadFake = (e) => {
    const files = e.target.files;
    if (files.length === 0) return;
    
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      // Cria registro mockado simulando o retorno da Cloud Function
      const novoArquivo = {
        nome_original: file.name,
        caminho_bruto: `bruto/${file.name}`,
        caminho_tratado: `tratado/${file.name.replace('.xls', '.xlsx')}`,
        total_linhas: 15,
        processado_em: new Date().toLocaleString('pt-BR'),
        status: 'sucesso'
      };
      
      setArquivos([novoArquivo, ...arquivos]);
      
      // Adiciona itens mocks adicionais
      const novosRegistros = [
        {
          Num_NE: "2026NE" + Math.floor(1000 + Math.random() * 9000),
          Credor: "CETAM PRESTADORES DE SERVIÇO",
          Processo: "08912/2026",
          Data_Emis: "15/06/2026",
          UO: "CETAM",
          PT: "12.361.3190.2814",
          Fonte: "0100",
          Natureza: "339036 - OUTROS SERVIÇOS DE TERCEIROS - PF",
          Emp_Mes: 300000.00,
          Emp_Acum: 900000.00,
          Liq_Mes: 250000.00,
          Liq_Acum: 800000.00,
          A_Liquidar: 100000.00,
          Pago_Mes: 200000.00,
          Pago_Acum: 750000.00,
          A_Pagar: 50000.00,
          Ano_Processo: "2026"
        }
      ];

      setDados([...novosRegistros, ...dados]);
      alert("Planilha enviada com sucesso! A Cloud Function em Python tratou a planilha bruto e atualizou os gráficos.");
    };
    reader.readAsArrayBuffer(file);
  };

  // Novo Cadastro de Usuário (Admin)
  const cadastrarUsuario = (e) => {
    e.preventDefault();
    if (!novoEmail || !novoNome) return;
    setUsuariosAutorizados([...usuariosAutorizados, { email: novoEmail, name: novoNome, role: novoCargo }]);
    setNovoEmail('');
    setNovoNome('');
    alert(`Usuário ${novoNome} autorizado com sucesso no sistema!`);
  };

  // Preparação de dados para Gráficos
  // 1. Evolução mensal dos pagamentos
  const dataEvolucaoMensal = [
    { name: 'Jan', Empenhado: totais.empAcum * 0.15, Pago: totais.pagoAcum * 0.12 },
    { name: 'Fev', Empenhado: totais.empAcum * 0.30, Pago: totais.pagoAcum * 0.25 },
    { name: 'Mar', Empenhado: totais.empAcum * 0.45, Pago: totais.pagoAcum * 0.38 },
    { name: 'Abr', Empenhado: totais.empAcum * 0.65, Pago: totais.pagoAcum * 0.55 },
    { name: 'Mai', Empenhado: totais.empAcum * 0.85, Pago: totais.pagoAcum * 0.75 },
    { name: 'Jun', Empenhado: totais.empAcum, Pago: totais.pagoAcum }
  ];

  // 2. Gráfico por Natureza (Rosca)
  const despesasPorNatureza = dadosFiltrados.reduce((acc, item) => {
    const nat = item.Natureza.split(' - ')[0];
    const existente = acc.find(x => x.name === nat);
    if (existente) {
      existente.value += item.Emp_Acum;
    } else {
      acc.push({ name: nat, value: item.Emp_Acum });
    }
    return acc;
  }, []);

  // 3. Pago e Empenhado por Exercício/Ano
  const totalPorAno = dadosFiltrados.reduce((acc, item) => {
    const ano = item.Ano_Processo;
    const existente = acc.find(x => x.ano === ano);
    if (existente) {
      existente.Empenhado += item.Emp_Acum;
      existente.Pago += item.Pago_Acum;
    } else {
      acc.push({ ano, Empenhado: item.Emp_Acum, Pago: item.Pago_Acum });
    }
    return acc;
  }, []).sort((a, b) => a.ano.localeCompare(b.ano));

  // 4. Maiores Orçamentos por Credor
  const maioresCredores = [...dadosFiltrados]
    .sort((a, b) => b.Emp_Acum - a.Emp_Acum)
    .slice(0, 5)
    .map(x => ({ name: x.Credor.substring(0, 15) + '...', Empenhado: x.Emp_Acum, Pago: x.Pago_Acum }));

  // 5. Funil
  const dataFunil = [
    { value: totais.empAcum, name: '1. Empenhado', fill: '#6366f1' },
    { value: totais.liqAcum, name: '2. Liquidado', fill: '#a855f7' },
    { value: totais.pagoAcum, name: '3. Pago', fill: '#10b981' }
  ];

  return (
    <div className={`min-h-screen flex ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Sidebar Fixo lateral */}
      <aside className={`w-72 flex-shrink-0 border-r ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'} p-6 flex flex-col justify-between`}>
        <div>
          {/* Logo / Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30">
              AFI
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">CETAM</h1>
              <span className="text-xs text-slate-500">Orçamento Avançado</span>
            </div>
          </div>

          {/* Menu de Navegação */}
          <nav className="space-y-2">
            <button 
              onClick={() => setCurrentPage('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentPage === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100'}`}
            >
              <LayoutDashboard size={20} />
              <span className="font-semibold text-sm">Dashboard Geral</span>
            </button>
            <button 
              onClick={() => setCurrentPage('avancados')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentPage === 'avancados' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100'}`}
            >
              <TrendingUp size={20} />
              <span className="font-semibold text-sm">Visuais Avançados</span>
            </button>
            <button 
              onClick={() => setCurrentPage('auditoria')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentPage === 'auditoria' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100'}`}
            >
              <AlertTriangle size={20} />
              <span className="font-semibold text-sm">Matriz de Gargalos</span>
            </button>
            <button 
              onClick={() => setCurrentPage('upload')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentPage === 'upload' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100'}`}
            >
              <Upload size={20} />
              <span className="font-semibold text-sm">Upload e Histórico</span>
            </button>
            
            {/* Rota Protegida (Lucivaldo) */}
            {user.email === 'lucivaldo586@gmail.com' && (
              <button 
                onClick={() => setCurrentPage('usuarios')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentPage === 'usuarios' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100'}`}
              >
                <Users size={20} />
                <span className="font-semibold text-sm">Usuários (Admin)</span>
              </button>
            )}
          </nav>
        </div>

        {/* Perfil & Configurações de Rodapé */}
        <div className="space-y-4">
          {/* Alternador de Modo Escuro */}
          <div className={`flex items-center justify-between p-2 rounded-xl ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <span className="text-xs font-semibold px-2 text-slate-500">Aparência</span>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 rounded-lg bg-indigo-600 text-white shadow"
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          {/* Usuário Conectado */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white uppercase">
              {user.name.substring(0, 2)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold truncate leading-none mb-1">{user.name}</p>
              <span className="text-xs text-slate-500 truncate flex items-center gap-1">
                <ShieldCheck size={12} className="text-emerald-500" /> Administrador
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 overflow-y-auto p-10" id="dashboard-content">
        
        {/* Topbar Header */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <span className="text-sm font-medium text-slate-400">CETAM AM</span>
            <h2 className="text-3xl font-bold tracking-tight">Análise AFI Orçamentária</h2>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={exportarPDF} 
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/10 transition"
            >
              <FileDown size={18} /> Exportar PDF
            </button>
            <button 
              onClick={exportarXLS} 
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold shadow-md transition"
            >
              <Download size={18} /> Exportar Tabela
            </button>
          </div>
        </header>

        {/* Painel Central */}
        {currentPage === 'dashboard' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Barra de Filtros Integrados */}
            <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm space-y-4`}>
              <div className="flex flex-col md:flex-row gap-4">
                {/* Busca Reativa Única */}
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Pesquisar por Credor, NE, Processo, Natureza, PT, Fonte..." 
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className={`w-full pl-11 pr-4 py-3 rounded-xl border outline-none text-sm transition ${darkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500'}`}
                  />
                </div>

                {/* Filtro Ano */}
                <div className="w-full md:w-48">
                  <select 
                    value={filtroAno} 
                    onChange={(e) => setFiltroAno(e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border outline-none text-sm ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                  >
                    {anosDisponiveis.map(ano => <option key={ano} value={ano}>Ano: {ano}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
                <span className="text-xs font-semibold text-slate-400">Empenhado (Mês)</span>
                <p className="text-2xl font-bold tracking-tight mt-1">{formatarMoeda(totais.empMes)}</p>
              </div>
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
                <span className="text-xs font-semibold text-slate-400">Empenhado (Acumulado)</span>
                <p className="text-2xl font-bold tracking-tight mt-1 text-indigo-500">{formatarMoeda(totais.empAcum)}</p>
              </div>
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
                <span className="text-xs font-semibold text-slate-400">Liquidado (Mês)</span>
                <p className="text-2xl font-bold tracking-tight mt-1">{formatarMoeda(totais.liqMes)}</p>
              </div>
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
                <span className="text-xs font-semibold text-slate-400">Liquidado (Acumulado)</span>
                <p className="text-2xl font-bold tracking-tight mt-1 text-purple-500">{formatarMoeda(totais.liqAcum)}</p>
              </div>
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
                <span className="text-xs font-semibold text-slate-400">A Liquidar</span>
                <p className="text-2xl font-bold tracking-tight mt-1 text-amber-500">{formatarMoeda(totais.aLiquidar)}</p>
              </div>
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
                <span className="text-xs font-semibold text-slate-400">Pago (Acumulado)</span>
                <p className="text-2xl font-bold tracking-tight mt-1 text-emerald-500">{formatarMoeda(totais.pagoAcum)}</p>
              </div>
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
                <span className="text-xs font-semibold text-slate-400">A Pagar</span>
                <p className="text-2xl font-bold tracking-tight mt-1 text-rose-500">{formatarMoeda(totais.aPagar)}</p>
              </div>
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
                <span className="text-xs font-semibold text-slate-400">% Execução Orçamentária</span>
                <p className="text-2xl font-bold tracking-tight mt-1 text-blue-500">{percentualExecucao.toFixed(1)}%</p>
              </div>
            </div>

            {/* Graficos Principais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Gráfico 1: Evolução Mensal dos Pagamentos */}
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
                <h3 className="text-lg font-bold mb-4">Evolução Mensal (Empenhado vs Pago)</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dataEvolucaoMensal}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#334155" : "#e2e8f0"} />
                      <XAxis dataKey="name" stroke={darkMode ? "#94a3b8" : "#64748b"} />
                      <YAxis stroke={darkMode ? "#94a3b8" : "#64748b"} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="Empenhado" stroke="#6366f1" strokeWidth={3} activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="Pago" stroke="#10b981" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfico 2: Pago vs Empenhado por Exercício */}
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
                <h3 className="text-lg font-bold mb-4">Exercícios Anteriores (Comparativo Anual)</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={totalPorAno}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#334155" : "#e2e8f0"} />
                      <XAxis dataKey="ano" stroke={darkMode ? "#94a3b8" : "#64748b"} />
                      <YAxis stroke={darkMode ? "#94a3b8" : "#64748b"} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Empenhado" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Pago" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Outros Gráficos Adicionais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Gráfico 3: Maiores Credores por Orçamento */}
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
                <h3 className="text-lg font-bold mb-4">Top 5 Credores (Maiores Empenhos)</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={maioresCredores} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#334155" : "#e2e8f0"} />
                      <XAxis type="number" stroke={darkMode ? "#94a3b8" : "#64748b"} />
                      <YAxis dataKey="name" type="category" stroke={darkMode ? "#94a3b8" : "#64748b"} width={100} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Empenhado" fill="#ec4899" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Tabela de Empenhos de Hoje */}
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-bold">Empenhos para a Data de Hoje</h3>
                    <p className="text-xs text-slate-500">Filtrado automaticamente para 15/06/2026</p>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Total: {formatarMoeda(valorHoje)}
                  </span>
                </div>
                <div className="overflow-x-auto h-72">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="py-2.5 text-xs font-semibold text-slate-400">Credor</th>
                        <th className="py-2.5 text-xs font-semibold text-slate-400">Num NE</th>
                        <th className="py-2.5 text-xs font-semibold text-slate-400 text-right">Valor Pago Mês</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empenhosHoje.length > 0 ? (
                        empenhosHoje.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                            <td className="py-3 text-sm font-semibold truncate max-w-xs">{item.Credor}</td>
                            <td className="py-3 text-sm">{item.Num_NE}</td>
                            <td className="py-3 text-sm font-bold text-right text-emerald-500">{formatarMoeda(item.Pago_Mes)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="py-8 text-center text-sm text-slate-500">Nenhum empenho agendado para o dia de hoje.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Visuais Avançados (Análise de Eficiência) */}
        {currentPage === 'avancados' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Rosca de Despesas por Natureza */}
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm col-span-2`}>
                <h3 className="text-lg font-bold mb-2">Despesas por Natureza de Pagamento</h3>
                <p className="text-xs text-slate-500 mb-6">Distribuição percentual dos recursos empenhados acumulados</p>
                <div className="h-80 flex flex-col md:flex-row items-center justify-around">
                  <div className="h-64 w-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={despesasPorNatureza}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {despesasPorNatureza.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {despesasPorNatureza.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="text-xs font-medium truncate max-w-xs">{entry.name}: {formatarMoeda(entry.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Gauge de Execução Orçamentária */}
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm flex flex-col items-center justify-center`}>
                <h3 className="text-lg font-bold mb-2 text-center w-full">Meta de Execução</h3>
                <p className="text-xs text-slate-500 mb-8 text-center w-full">Percentual geral Pago acumulado / Empenhado acumulado</p>
                
                {/* Velocímetro Simplificado */}
                <div className="relative w-48 h-24 overflow-hidden mb-4">
                  <div className="absolute top-0 left-0 w-48 h-48 rounded-full border-12 border-slate-200 dark:border-slate-800"></div>
                  <div 
                    className="absolute top-0 left-0 w-48 h-48 rounded-full border-12 border-indigo-600 transition-all duration-1000"
                    style={{
                      clipPath: 'polygon(0 50%, 100% 50%, 100% 0, 0 0)',
                      transform: `rotate(${Math.min(180, (percentualExecucao / 100) * 180)}deg)`,
                      transformOrigin: '50% 50%'
                    }}
                  ></div>
                  <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end">
                    <span className="text-4xl font-extrabold tracking-tight">{percentualExecucao.toFixed(1)}%</span>
                  </div>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  {percentualExecucao > 75 ? "Eficiência Alta" : percentualExecucao > 40 ? "Eficiência Média" : "Eficiência Crítica"}
                </span>
              </div>
            </div>

            {/* Funil de Execução */}
            <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
              <h3 className="text-lg font-bold mb-2">Funil de Execução Orçamentária</h3>
              <p className="text-xs text-slate-500 mb-8">Etapas desde o Empenho do orçamento até o Pagamento final no exercício corrente</p>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <FunnelChart>
                    <Tooltip />
                    <Funnel
                      dataKey="value"
                      data={dataFunil}
                      isAnimationActive
                    >
                      {dataFunil.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Matriz de Auditoria e Gargalos */}
        {currentPage === 'auditoria' && (
          <div className="space-y-8 animate-fadeIn">
            <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
              <h3 className="text-lg font-bold mb-2">Matriz de Gargalos e Indicadores de Risco</h3>
              <p className="text-xs text-slate-500 mb-6">Lista completa de Credores com empenhos de alto risco devido a altos montantes 'A Liquidar' ou 'A Pagar'.</p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="pb-3 text-xs font-semibold text-slate-400">Credor</th>
                      <th className="pb-3 text-xs font-semibold text-slate-400">Nº NE</th>
                      <th className="pb-3 text-xs font-semibold text-slate-400">Ano</th>
                      <th className="pb-3 text-xs font-semibold text-slate-400 text-right">Empenhado</th>
                      <th className="pb-3 text-xs font-semibold text-slate-400 text-right">A Liquidar</th>
                      <th className="pb-3 text-xs font-semibold text-slate-400 text-right">A Pagar</th>
                      <th className="pb-3 text-xs font-semibold text-slate-400 text-center">Risco</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dadosFiltrados.map((item, idx) => {
                      const riscoAlto = item.A_Pagar > 50000 || item.A_Liquidar > 100000;
                      return (
                        <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-4 font-semibold text-sm truncate max-w-xs">{item.Credor}</td>
                          <td className="py-4 text-sm">{item.Num_NE}</td>
                          <td className="py-4 text-sm">{item.Ano_Processo}</td>
                          <td className="py-4 text-sm text-right font-medium">{formatarMoeda(item.Emp_Acum)}</td>
                          <td className="py-4 text-sm text-right font-medium text-amber-500">{formatarMoeda(item.A_Liquidar)}</td>
                          <td className="py-4 text-sm text-right font-medium text-rose-500">{formatarMoeda(item.A_Pagar)}</td>
                          <td className="py-4 text-center">
                            {riscoAlto ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                Alto Gargalo
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Regular
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Área de Upload e Histórico */}
        {currentPage === 'upload' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Drag and Drop Container */}
            <div className={`p-10 rounded-2xl border-2 border-dashed ${darkMode ? 'border-slate-700 bg-slate-900/50' : 'border-slate-300 bg-white'} text-center flex flex-col items-center justify-center`}>
              <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 mb-4">
                <Upload size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">Carregar Relatório Orçamentário (AFI)</h3>
              <p className="text-sm text-slate-400 mb-6 max-w-sm">
                Arraste ou clique para enviar arquivos no formato original <span className="font-semibold text-indigo-500">.xls</span> gerados pelo sistema de orçamento.
              </p>
              
              <label className="cursor-pointer px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow shadow-indigo-600/10 transition">
                Selecionar Arquivo
                <input 
                  type="file" 
                  accept=".xls,.xlsx" 
                  className="hidden" 
                  onChange={handleUploadFake}
                />
              </label>
            </div>

            {/* Lista de Arquivos Tratados para Download */}
            <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
              <h3 className="text-lg font-bold mb-4">Arquivos Enviados e Histórico de Processamento</h3>
              <div className="space-y-4">
                {arquivos.map((arq, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600">
                        <FileSpreadsheet size={22} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold truncate max-w-xs">{arq.nome_original}</h4>
                        <span className="text-xs text-slate-500">
                          {arq.total_linhas} linhas extraídas • {arq.processado_em}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Processado por Python
                      </span>
                      <button 
                        onClick={exportarXLS}
                        className="p-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                        title="Baixar Planilha Tratada (.xlsx)"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Gerenciamento de Usuários (Apenas Visível para o Admin Lucivaldo) */}
        {currentPage === 'usuarios' && user.email === 'lucivaldo586@gmail.com' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Formulário de Cadastro */}
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
                <h3 className="text-lg font-bold mb-2">Autorizar Acesso</h3>
                <p className="text-xs text-slate-500 mb-6">Cadastre novos e-mails para permitir login e visualização dos dados orçamentários do CETAM.</p>
                
                <form onSubmit={cadastrarUsuario} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Nome Completo</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: Lucivaldo Braga"
                      value={novoNome}
                      onChange={(e) => setNovoNome(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none text-sm ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">E-mail de Acesso</label>
                    <input 
                      type="email" 
                      required
                      placeholder="usuario@cetam.am.gov.br"
                      value={novoEmail}
                      onChange={(e) => setNovoEmail(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none text-sm ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Cargo / Função</label>
                    <select 
                      value={novoCargo}
                      onChange={(e) => setNovoCargo(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none text-sm ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                    >
                      <option value="viewer">Visualizador Geral (Visualizar Gráficos)</option>
                      <option value="admin">Administrador (Pode Fazer Upload)</option>
                    </select>
                  </div>

                  <button 
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow transition"
                  >
                    <Plus size={18} /> Adicionar Usuário
                  </button>
                </form>
              </div>

              {/* Lista de Usuários do Sistema */}
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm lg:col-span-2`}>
                <h3 className="text-lg font-bold mb-4">Usuários Cadastrados</h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {usuariosAutorizados.map((usr, index) => (
                    <div key={index} className="flex justify-between items-center py-3">
                      <div>
                        <h4 className="text-sm font-bold">{usr.name}</h4>
                        <span className="text-xs text-slate-500">{usr.email}</span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${usr.role === 'admin' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'}`}>
                        {usr.role === 'admin' ? 'Administrador' : 'Visualizador'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
