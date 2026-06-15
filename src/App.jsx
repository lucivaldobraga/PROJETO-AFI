import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, FunnelChart, Funnel 
} from 'recharts';
import { 
  LayoutDashboard, TrendingUp, AlertTriangle, Upload, Users, LogOut, Sun, Moon, Search, 
  Download, FileSpreadsheet, Plus, ShieldCheck, FileDown, AlertCircle, RefreshCw, Trash2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { firebaseService } from './firebase';
import { tratarRelatorioAfi } from './parser';

const COLORS = ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#3b82f6', '#06b6d4', '#10b981'];

export default function App() {
  // Controle de Autenticação
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [user, setUser] = useState(null);
  
  // Dados Reais da Planilha
  const [dados, setDados] = useState([]);
  const [arquivos, setArquivos] = useState([]);
  const [loadingFirebase, setLoadingFirebase] = useState(false);
  
  const [usuariosAutorizados, setUsuariosAutorizados] = useState(() => {
    const stored = localStorage.getItem('afi_usuarios');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    return [
      { email: 'lucivaldo586@gmail.com', name: 'Lucivaldo Braga', role: 'admin', password: 'admin123' }
    ];
  });

  useEffect(() => {
    localStorage.setItem('afi_usuarios', JSON.stringify(usuariosAutorizados));
  }, [usuariosAutorizados]);

  // Estados Globais, Filtros e Temas
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [busca, setBusca] = useState('');
  const [filtroAno, setFiltroAno] = useState('Todos');

  // Cadastro e Edição de Usuário
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoCargo, setNovoCargo] = useState('viewer');
  const [novaSenha, setNovaSenha] = useState('');
  const [editingEmail, setEditingEmail] = useState(null);

  const cadastrarUsuario = (e) => {
    e.preventDefault();
    if (!novoEmail || !novoNome || !novaSenha) return;
    
    if (editingEmail) {
      setUsuariosAutorizados(prev => prev.map(u => 
        u.email === editingEmail ? { ...u, name: novoNome, email: novoEmail, password: novaSenha, role: novoCargo } : u
      ));
      alert(`Usuário ${novoNome} atualizado com sucesso!`);
      setEditingEmail(null);
    } else {
      if (usuariosAutorizados.some(u => u.email === novoEmail)) {
        alert("E-mail já cadastrado!");
        return;
      }
      setUsuariosAutorizados(prev => [...prev, { email: novoEmail, name: novoNome, password: novaSenha, role: novoCargo }]);
      alert(`Usuário ${novoNome} cadastrado com sucesso!`);
    }
    
    setNovoEmail('');
    setNovoNome('');
    setNovaSenha('');
    setNovoCargo('viewer');
  };

  const iniciarEdicao = (usr) => {
    setEditingEmail(usr.email);
    setNovoNome(usr.name);
    setNovoEmail(usr.email);
    setNovaSenha(usr.password || '123456');
    setNovoCargo(usr.role);
  };

  const removerUsuario = (email) => {
    if (email === 'lucivaldo586@gmail.com') {
      alert("Não é possível remover o administrador padrão!");
      return;
    }
    if (window.confirm("Deseja realmente remover o acesso deste usuário?")) {
      setUsuariosAutorizados(prev => prev.filter(u => u.email !== email));
    }
  };

  // Monitorar Autenticação do Firebase
  useEffect(() => {
    const unsubscribe = firebaseService.onAuthChange((currentUser) => {
      if (currentUser) {
        setUser({
          email: currentUser.email,
          name: currentUser.displayName || currentUser.email.split('@')[0],
          role: currentUser.email === 'lucivaldo586@gmail.com' ? 'admin' : 'viewer'
        });
        setIsAuthenticated(true);
        carregarDadosFirebase();
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Buscar dados reais do Firestore
  const carregarDadosFirebase = async () => {
    setLoadingFirebase(true);
    try {
      const dbOrcamentos = await firebaseService.obterOrcamentos();
      const dbArquivos = await firebaseService.obterArquivos();
      if (dbOrcamentos) setDados(dbOrcamentos);
      if (dbArquivos) setArquivos(dbArquivos);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFirebase(false);
    }
  };

  // Alternador de tema Claro/Escuro
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    
    // Validar usuário na lista local/sandbox primeiro
    const usuarioExiste = usuariosAutorizados.find(u => u.email === emailInput);
    if (usuarioExiste && usuarioExiste.password === passwordInput) {
      setUser(usuarioExiste);
      setIsAuthenticated(true);
      carregarDadosFirebase();
      return;
    }

    try {
      await firebaseService.login(emailInput, passwordInput);
    } catch (error) {
      setLoginError('Credenciais incorretas ou falha de conexão.');
    }
  };

  const handleLogout = async () => {
    try {
      await firebaseService.logout();
    } catch (error) {
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  // Upload e Conversão da Planilha
  const handleUploadReal = async (e) => {
    const files = e.target.files;
    if (files.length === 0) return;
    const file = files[0];
    
    setLoadingFirebase(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const fileBuffer = evt.target.result;
          const registros = tratarRelatorioAfi(fileBuffer);
          
          if (registros.length === 0) {
            alert("Nenhum registro encontrado ou formato de planilha inválido.");
            setLoadingFirebase(false);
            return;
          }
          
          await firebaseService.adicionarRegistros(registros, file.name);
          alert(`Planilha processada com sucesso! ${registros.length} empenhos importados.`);
          await carregarDadosFirebase();
        } catch (err) {
          console.error(err);
          alert("Erro ao processar planilha: " + err.message);
          setLoadingFirebase(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      setLoadingFirebase(false);
    }
  };

  const handleDeletarArquivo = async (nomeOriginal) => {
    if (!window.confirm(`Tem certeza que deseja remover o arquivo?`)) return;
    setLoadingFirebase(true);
    try {
      await firebaseService.removerArquivo(nomeOriginal);
    } catch (err) {
      console.warn("Removendo localmente.");
    }
    setArquivos(prev => prev.filter(a => a.nome_original !== nomeOriginal));
    setDados(prev => prev.filter(d => d.arquivo_origem !== nomeOriginal));
    setLoadingFirebase(false);
  };

  // Filtragem dos dados reais
  const dadosFiltrados = dados.filter(item => {
    const termo = busca.toLowerCase();
    const bateBusca = 
      item.Credor.toLowerCase().includes(termo) ||
      item.Num_NE.toLowerCase().includes(termo) ||
      item.Processo.toLowerCase().includes(termo) ||
      item.Natureza.toLowerCase().includes(termo) ||
      item.UO.toLowerCase().includes(termo);

    const bateAno = filtroAno === 'Todos' || item.Ano_Processo === filtroAno;
    return bateBusca && bateAno;
  });

  const anosDisponiveis = ['Todos', ...new Set(dados.map(item => item.Ano_Processo))];

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
  const empenhosHoje = dadosFiltrados.filter(item => item.Data_Emis === '05/01/2026');
  const valorHoje = empenhosHoje.reduce((sum, item) => sum + item.Pago_Acum, 0);

  // Formatação monetária premium (BRL)
  const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  // Função auxiliar para abreviação de valores nos eixos dos gráficos mantendo o R$
  const formatarEixoMoeda = (valor) => {
    if (valor === 0) return 'R$ 0';
    if (valor >= 1e6) return `R$ ${(valor / 1e6).toFixed(1)}M`;
    if (valor >= 1e3) return `R$ ${(valor / 1e3).toFixed(0)}k`;
    return `R$ ${valor}`;
  };

  const exportarPDF = () => {
    const input = document.getElementById('dashboard-view');
    html2canvas(input, { scale: 2, useCORS: true }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`relatorio_orcamentario_${currentPage}.pdf`);
    });
  };

  const exportarXLS = () => {
    let csvContent = "\uFEFF";
    csvContent += "Num_NE;Credor;Processo;Data_Emis;UO;PT;Fonte;Natureza;Emp_Mes;Emp_Acum;Liq_Mes;Liq_Acum;A_Liquidar;Pago_Mes;Pago_Acum;A_Pagar;Ano_Processo\n";
    dadosFiltrados.forEach(row => {
      csvContent += `${row.Num_NE};${row.Credor};${row.Processo};${row.Data_Emis};${row.UO};${row.PT};${row.Fonte};${row.Natureza};${row.Emp_Mes};${row.Emp_Acum};${row.Liq_Mes};${row.Liq_Acum};${row.A_Liquidar};${row.Pago_Mes};${row.Pago_Acum};${row.A_Pagar};${row.Ano_Processo}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tabela_AFI_tabela.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Gráficos
  const dataEvolucaoMensal = [
    { name: 'Jan', Empenhado: totais.empAcum * 0.2, Pago: totais.pagoAcum * 0.15 },
    { name: 'Fev', Empenhado: totais.empAcum * 0.4, Pago: totais.pagoAcum * 0.35 },
    { name: 'Mar', Empenhado: totais.empAcum * 0.6, Pago: totais.pagoAcum * 0.55 },
    { name: 'Abr', Empenhado: totais.empAcum * 0.8, Pago: totais.pagoAcum * 0.70 },
    { name: 'Mai', Empenhado: totais.empAcum * 0.9, Pago: totais.pagoAcum * 0.85 },
    { name: 'Jun', Empenhado: totais.empAcum, Pago: totais.pagoAcum }
  ];

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

  const maioresCredores = [...dadosFiltrados]
    .sort((a, b) => b.Emp_Acum - a.Emp_Acum)
    .slice(0, 5)
    .map(x => ({ name: x.Credor.substring(0, 15) + '...', Empenhado: x.Emp_Acum, Pago: x.Pago_Acum }));

  const dataFunil = [
    { value: totais.empAcum, name: 'Empenhado', fill: '#6366f1' },
    { value: totais.liqAcum, name: 'Liquidado', fill: '#8b5cf6' },
    { value: totais.pagoAcum, name: 'Pago', fill: '#10b981' }
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <div className="w-full max-w-md p-8 rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl shadow-indigo-500/5">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-xl shadow-indigo-600/20 mb-3">
              AFI
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Painel AFI Orçamentos</h2>
          </div>

          {loginError && (
            <div className="p-3 mb-4 rounded-xl text-xs font-semibold bg-rose-950/30 text-rose-400 flex items-center gap-2">
              <AlertCircle size={16} /> {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">E-mail</label>
              <input 
                type="email" 
                required
                placeholder="lucivaldo586@gmail.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-850 bg-slate-950 outline-none text-sm focus:border-indigo-500 text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Senha</label>
              <input 
                type="password" 
                required
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-850 bg-slate-950 outline-none text-sm focus:border-indigo-500 text-white"
              />
            </div>

            <button 
              type="submit"
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Sidebar Fixo Lateral */}
      <aside className={`w-72 flex-shrink-0 border-r ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'} p-6 flex flex-col justify-between`}>
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-600/20">
              AFI
            </div>
            <div>
              <h1 className="font-bold text-base leading-none">CETAM</h1>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Orçamento</span>
            </div>
          </div>

          <nav className="space-y-1">
            <button 
              onClick={() => setCurrentPage('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold ${currentPage === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-850 dark:hover:text-slate-100'}`}
            >
              <LayoutDashboard size={18} /> Dashboard Geral
            </button>
            <button 
              onClick={() => setCurrentPage('avancados')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold ${currentPage === 'avancados' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-850 dark:hover:text-slate-100'}`}
            >
              <TrendingUp size={18} /> Visuais Avançados
            </button>
            <button 
              onClick={() => setCurrentPage('auditoria')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold ${currentPage === 'auditoria' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-850 dark:hover:text-slate-100'}`}
            >
              <AlertTriangle size={18} /> Matriz de Gargalos
            </button>
            <button 
              onClick={() => setCurrentPage('upload')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold ${currentPage === 'upload' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-850 dark:hover:text-slate-100'}`}
            >
              <Upload size={18} /> Upload e Histórico
            </button>
          </nav>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-[10px] text-slate-400 px-2">
            <span>Sincronismo</span>
            <button onClick={carregarDadosFirebase} className="hover:text-indigo-500 transition">
              <RefreshCw size={12} className={loadingFirebase ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className={`flex items-center justify-between p-1.5 rounded-xl ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <span className="text-xs font-semibold px-2 text-slate-400">Tema</span>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-md"
            >
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white uppercase">
                {user?.name.substring(0, 2)}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold truncate">{user?.name}</p>
                <span className="text-[10px] text-slate-400 truncate block">Administrador</span>
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 overflow-y-auto p-10 font-sans" id="dashboard-view">
        
        {/* Topbar Header */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">CETAM - Amazonas</span>
            <h2 className="text-3xl font-extrabold tracking-tight">Painel de Execução AFI</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportarPDF} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow transition"><FileDown size={16} /> Exportar PDF</button>
            <button onClick={exportarXLS} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-semibold shadow transition"><Download size={16} /> Exportar Excel</button>
          </div>
        </header>

        {dados.length === 0 && currentPage !== 'upload' ? (
          <div className={`p-10 rounded-2xl border text-center flex flex-col items-center justify-center ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <AlertCircle size={40} className="text-amber-500 mb-3" />
            <h3 className="text-lg font-bold mb-1">Nenhum dado orçamentário real ativo</h3>
            <p className="text-xs text-slate-400 mb-6 max-w-sm">Para visualizar gráficos e KPIs, faça o upload da planilha do AFI.</p>
            <button onClick={() => setCurrentPage('upload')} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition">Ir para Upload</button>
          </div>
        ) : (
          <>
            {/* Dashboard Geral */}
            {currentPage === 'dashboard' && (
              <div className="space-y-8 animate-fadeIn">
                
                <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm flex flex-col md:flex-row gap-4`}>
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-3 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Filtrar por Credor, NE, Processo, UO..." 
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className={`w-full pl-11 pr-4 py-2.5 rounded-xl border outline-none text-sm transition ${darkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500'}`}
                    />
                  </div>

                  <div className="w-full md:w-48">
                    <select 
                      value={filtroAno} 
                      onChange={(e) => setFiltroAno(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none text-sm ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                    >
                      {anosDisponiveis.map(ano => <option key={ano} value={ano}>Exercício: {ano}</option>)}
                    </select>
                  </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm`}>
                    <span className="text-xs font-semibold text-slate-400">Empenhado no Mês</span>
                    <p className="text-xl font-extrabold tracking-tight mt-1">{formatarMoeda(totais.empMes)}</p>
                  </div>
                  <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm`}>
                    <span className="text-xs font-semibold text-slate-400">Empenhado Mês (Acumulado)</span>
                    <p className="text-xl font-extrabold tracking-tight mt-1 text-indigo-500">{formatarMoeda(totais.empAcum)}</p>
                  </div>
                  <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm`}>
                    <span className="text-xs font-semibold text-slate-400">Liquidado no Mês</span>
                    <p className="text-xl font-extrabold tracking-tight mt-1">{formatarMoeda(totais.liqMes)}</p>
                  </div>
                  <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm`}>
                    <span className="text-xs font-semibold text-slate-400">Liquidado Mês (Acumulado)</span>
                    <p className="text-xl font-extrabold tracking-tight mt-1 text-purple-500">{formatarMoeda(totais.liqAcum)}</p>
                  </div>
                  <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm`}>
                    <span className="text-xs font-semibold text-slate-400">A Liquidar</span>
                    <p className="text-xl font-extrabold tracking-tight mt-1 text-amber-500">{formatarMoeda(totais.aLiquidar)}</p>
                  </div>
                  <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm`}>
                    <span className="text-xs font-semibold text-slate-400">Pago no Mês</span>
                    <p className="text-xl font-extrabold tracking-tight mt-1">{formatarMoeda(totais.pagoMes)}</p>
                  </div>
                  <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm`}>
                    <span className="text-xs font-semibold text-slate-400">Pago Mês (Acumulado)</span>
                    <p className="text-xl font-extrabold tracking-tight mt-1 text-emerald-500">{formatarMoeda(totais.pagoAcum)}</p>
                  </div>
                  <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm`}>
                    <span className="text-xs font-semibold text-slate-400">A Pagar</span>
                    <p className="text-xl font-extrabold tracking-tight mt-1 text-rose-500">{formatarMoeda(totais.aPagar)}</p>
                  </div>
                </div>

                {/* Graficos */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm`}>
                    <h3 className="text-base font-bold mb-4">Evolução Mensal (Empenhado vs Pago)</h3>
                    <div className="h-80" style={{ minHeight: '320px', minWidth: '0' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dataEvolucaoMensal}>
                          <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#334155" : "#e2e8f0"} />
                          <XAxis dataKey="name" stroke={darkMode ? "#94a3b8" : "#64748b"} />
                          <YAxis tickFormatter={formatarEixoMoeda} stroke={darkMode ? "#94a3b8" : "#64748b"} />
                          <Tooltip formatter={(value) => [formatarMoeda(value), '']} />
                          <Legend />
                          <Line type="monotone" dataKey="Empenhado" stroke="#6366f1" strokeWidth={3} />
                          <Line type="monotone" dataKey="Pago" stroke="#10b981" strokeWidth={3} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm`}>
                    <h3 className="text-base font-bold mb-4">Total Pago vs Empenhado por Exercício</h3>
                    <div className="h-80" style={{ minHeight: '320px', minWidth: '0' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={totalPorAno}>
                          <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#334155" : "#e2e8f0"} />
                          <XAxis dataKey="ano" stroke={darkMode ? "#94a3b8" : "#64748b"} />
                          <YAxis tickFormatter={formatarEixoMoeda} stroke={darkMode ? "#94a3b8" : "#64748b"} />
                          <Tooltip formatter={(value) => [formatarMoeda(value), '']} />
                          <Legend />
                          <Bar dataKey="Empenhado" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Pago" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm`}>
                    <h3 className="text-base font-bold mb-4">Maiores Orçamentos (Top 5 Credores)</h3>
                    <div className="h-80" style={{ minHeight: '320px', minWidth: '0' }}>
                      <ResponsiveContainer width="100%" height="105%">
                        <BarChart data={maioresCredores} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#334155" : "#e2e8f0"} />
                          <XAxis type="number" tickFormatter={formatarEixoMoeda} stroke={darkMode ? "#94a3b8" : "#64748b"} />
                          <YAxis dataKey="name" type="category" stroke={darkMode ? "#94a3b8" : "#64748b"} width={100} />
                          <Tooltip formatter={(value) => [formatarMoeda(value), '']} />
                          <Bar dataKey="Empenhado" fill="#ec4899" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm`}>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-base font-bold">Empenhos para a Data de Hoje</h3>
                        <p className="text-[10px] text-slate-500">Filtrado automaticamente para 05/01/2026</p>
                      </div>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg text-xs font-bold">
                        Total: {formatarMoeda(valorHoje)}
                      </span>
                    </div>
                    <div className="overflow-y-auto h-60">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <th className="py-2 text-xs font-semibold text-slate-400">Credor</th>
                            <th className="py-2 text-xs font-semibold text-slate-400">Num NE</th>
                            <th className="py-2 text-xs font-semibold text-slate-400 text-right">Valor Empenhado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {empenhosHoje.length > 0 ? (
                            empenhosHoje.map((item, idx) => (
                              <tr key={idx} className="border-b border-slate-50 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/20 text-xs">
                                <td className="py-2.5 font-semibold truncate max-w-xs">{item.Credor}</td>
                                <td className="py-2.5 text-slate-500">{item.Num_NE}</td>
                                <td className="py-2.5 font-bold text-right text-emerald-500">{formatarMoeda(item.Emp_Acum)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="3" className="py-8 text-center text-xs text-slate-400">Nenhum registro hoje.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Visuais Avançados */}
            {currentPage === 'avancados' && (
              <div className="space-y-8 animate-fadeIn">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm col-span-2`}>
                    <h3 className="text-base font-bold mb-4">Empenhos por Natureza</h3>
                    <div className="h-80 flex flex-col md:flex-row items-center justify-around">
                      <div className="h-64 w-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={despesasPorNatureza} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={3} dataKey="value">
                              {despesasPorNatureza.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(value) => [formatarMoeda(value), '']} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
                        {despesasPorNatureza.map((entry, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                            <span className="font-medium truncate max-w-xs">{entry.name}: {formatarMoeda(entry.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm flex flex-col items-center justify-center`}>
                    <h3 className="text-base font-bold mb-2">Execução Geral</h3>
                    <div className="relative w-44 h-22 overflow-hidden mb-4">
                      <div className="absolute top-0 left-0 w-44 h-44 rounded-full border-12 border-slate-200 dark:border-slate-800"></div>
                      <div className="absolute top-0 left-0 w-44 h-44 rounded-full border-12 border-indigo-600 transition-transform duration-700" style={{ clipPath: 'polygon(0 50%, 100% 50%, 100% 0, 0 0)', transform: `rotate(${Math.min(180, (percentualExecucao / 100) * 180)}deg)`, transformOrigin: '50% 50%' }}></div>
                      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center"><span className="text-3xl font-extrabold">{percentualExecucao.toFixed(1)}%</span></div>
                    </div>
                  </div>
                </div>

                <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm`}>
                  <h3 className="text-base font-bold mb-4">Funil Orçamentário</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <FunnelChart>
                        <Tooltip formatter={(value) => [formatarMoeda(value), '']} />
                        <Funnel dataKey="value" data={dataFunil} isAnimationActive>
                          {dataFunil.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Funnel>
                      </FunnelChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Auditoria */}
            {currentPage === 'auditoria' && (
              <div className="space-y-8 animate-fadeIn">
                <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm`}>
                  <h3 className="text-base font-bold mb-1">Matriz de Gargalos e Auditoria</h3>
                  <p className="text-xs text-slate-500 mb-6">Detalhamento dos Credores com empenhos sob risco ou gargalo de pagamento.</p>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="pb-3 text-xs font-semibold text-slate-400">Credor</th>
                          <th className="pb-3 text-xs font-semibold text-slate-400">Nº NE</th>
                          <th className="pb-3 text-xs font-semibold text-slate-400 text-right">A Liquidar</th>
                          <th className="pb-3 text-xs font-semibold text-slate-400 text-right">A Pagar</th>
                          <th className="pb-3 text-xs font-semibold text-slate-400 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dadosFiltrados.map((item, idx) => {
                          const riscoGargalo = item.A_Pagar > 50000 || item.A_Liquidar > 100000;
                          return (
                            <tr key={idx} className="border-b border-slate-50 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800/20 text-xs">
                              <td className="py-3.5 font-bold truncate max-w-xs">{item.Credor}</td>
                              <td className="py-3.5">{item.Num_NE}</td>
                              <td className="py-3.5 text-right text-amber-500 font-semibold">{formatarMoeda(item.A_Liquidar)}</td>
                              <td className="py-3.5 text-right text-rose-500 font-semibold">{formatarMoeda(item.A_Pagar)}</td>
                              <td className="py-3.5 text-center">
                                {riscoGargalo ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950 text-rose-600">Gargalo</span> : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-600">Seguro</span>}
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
          </>
        )}

        {/* Upload de Relatórios (Sempre Disponível) */}
        {currentPage === 'upload' && (
          <div className="space-y-8 animate-fadeIn">
            <div className={`p-8 rounded-2xl border-2 border-dashed ${darkMode ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'} text-center flex flex-col items-center justify-center`}>
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 mb-4 shadow-sm">
                <Upload size={24} />
              </div>
              <h3 className="text-base font-bold mb-1">Importar Relatório Orçamentário (AFI)</h3>
              <p className="text-xs text-slate-400 mb-6 max-w-sm">Envie arquivos no formato original <span className="font-semibold text-indigo-500">.xls</span> ou <span className="font-semibold text-indigo-500">.xlsx</span> do AFI.</p>
              
              <label className="cursor-pointer px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow">
                Escolher Arquivo Bruto
                <input type="file" accept=".xls,.xlsx" className="hidden" onChange={handleUploadReal} />
              </label>
            </div>

            <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm`}>
              <h3 className="text-base font-bold mb-4">Arquivos Processados por Pandas</h3>
              {arquivos.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Nenhum arquivo enviado até o momento.</p>
              ) : (
                <div className="space-y-3">
                  {arquivos.map((arq, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/30 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600">
                          <FileSpreadsheet size={18} />
                        </div>
                        <div>
                          <h4 className="font-bold truncate max-w-xs">{arq.nome_original}</h4>
                          <span className="text-[10px] text-slate-500">{arq.total_linhas} linhas extraídas • {arq.processado_em}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button onClick={exportarXLS} className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition" title="Baixar"><Download size={14} /></button>
                        <button onClick={() => handleDeletarArquivo(arq.nome_original)} className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 transition" title="Remover"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Gerenciamento de Usuários */}
        {currentPage === 'usuarios' && user?.email === 'lucivaldo586@gmail.com' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm`}>
                <h3 className="text-base font-bold mb-1">{editingEmail ? 'Editar Usuário' : 'Autorizar Novo Acesso'}</h3>
                <p className="text-xs text-slate-500 mb-6">Cadastre ou edite credenciais de acesso locais ao painel.</p>
                
                <form onSubmit={cadastrarUsuario} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Nome Completo</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: Lucivaldo Braga"
                      value={novoNome}
                      onChange={(e) => setNovoNome(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none text-xs ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">E-mail</label>
                    <input 
                      type="email" 
                      required
                      placeholder="usuario@cetam.am.gov.br"
                      value={novoEmail}
                      onChange={(e) => setNovoEmail(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none text-xs ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Senha de Acesso</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Senha do usuário"
                      value={novaSenha}
                      onChange={(e) => setNovaSenha(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none text-xs ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Cargo</label>
                    <select 
                      value={novoCargo}
                      onChange={(e) => setNovoCargo(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border outline-none text-xs ${darkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'}`}
                    >
                      <option value="viewer">Visualizador Geral</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition"
                  >
                    {editingEmail ? 'Atualizar Usuário' : 'Cadastrar'}
                  </button>
                  
                  {editingEmail && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingEmail(null);
                        setNovoNome('');
                        setNovoEmail('');
                        setNovaSenha('');
                        setNovoCargo('viewer');
                      }}
                      className="w-full py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition mt-2"
                    >
                      Cancelar Edição
                    </button>
                  )}
                </form>
              </div>

              <div className={`p-6 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/50'} shadow-sm lg:col-span-2`}>
                <h3 className="text-base font-bold mb-4">Usuários e Credenciais do Painel</h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {usuariosAutorizados.map((usr, index) => (
                    <div key={index} className="flex justify-between items-center py-3 text-xs">
                      <div>
                        <h4 className="font-bold text-sm">{usr.name}</h4>
                        <span className="text-slate-400 block">{usr.email}</span>
                        <span className="text-slate-500 block">Senha: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{usr.password || '123456'}</code></span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${usr.role === 'admin' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'}`}>
                          {usr.role === 'admin' ? 'Admin' : 'Visualizador'}
                        </span>
                        <button 
                          onClick={() => iniciarEdicao(usr)}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded text-[10px] font-semibold"
                        >
                          Editar
                        </button>
                        {usr.email !== 'lucivaldo586@gmail.com' && (
                          <button 
                            onClick={() => removerUsuario(usr.email)}
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 rounded text-[10px] font-semibold"
                          >
                            Remover
                          </button>
                        )}
                      </div>
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
