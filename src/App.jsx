import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, FunnelChart, Funnel, LabelList
} from 'recharts';
import {
  LayoutDashboard, TrendingUp, AlertTriangle, Upload, Users, LogOut, Sun, Moon, Search,
  Download, FileSpreadsheet, Plus, ShieldCheck, FileDown, AlertCircle, RefreshCw, Trash2,
  ChevronDown, X
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { firebaseService } from './firebase';
import { tratarRelatorioAfi } from './parser';
import logoImg from './assets/logo.png';

const COLORS = ['#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#3b82f6', '#06b6d4', '#10b981'];

function SearchableDropdown({ label, value, onChange, options, placeholder, darkMode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = React.useRef(null);

  useEffect(() => {
    if (value === 'Todos') {
      setSearchTerm('');
    } else {
      setSearchTerm(value || '');
    }
  }, [value, isOpen]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredOptions = React.useMemo(() => {
    const cleanTerm = searchTerm.toLowerCase().trim();
    const baseOptions = options.filter(opt => opt && opt !== 'Todos');

    let matches = baseOptions;
    if (cleanTerm) {
      matches = baseOptions.filter(opt =>
        String(opt).toLowerCase().includes(cleanTerm)
      );
    }

    return ['Todos', ...matches.slice(0, 100)];
  }, [options, searchTerm]);

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    setSearchTerm(newVal);
    setIsOpen(true);
    if (newVal.trim() === '') {
      onChange('Todos');
    } else {
      onChange(newVal);
    }
  };

  const handleSelectOption = (opt) => {
    onChange(opt);
    setSearchTerm(opt === 'Todos' ? '' : opt);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || "Pesquisar..."}
          className={`w-full pl-4 pr-8 py-2.5 rounded-full border outline-none text-xs transition ${darkMode
            ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500 placeholder-slate-600'
            : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500 placeholder-slate-400'
            }`}
        />
        <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
          {searchTerm && (
            <button
              type="button"
              onClick={() => handleSelectOption('Todos')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform cursor-pointer ${isOpen ? 'rotate-180' : ''}`}
            onClick={() => setIsOpen(!isOpen)}
          />
        </div>
      </div>

      {isOpen && (
        <ul className={`absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-2xl border shadow-lg text-xs ${darkMode
          ? 'bg-slate-950 border-slate-800 text-white divide-y divide-slate-850'
          : 'bg-white border-slate-200 text-slate-800 divide-y divide-slate-105'
          }`}>
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-slate-400 italic">Nenhum resultado</li>
          ) : (
            filteredOptions.map((opt) => (
              <li
                key={opt}
                onClick={() => handleSelectOption(opt)}
                className={`px-3 py-2 cursor-pointer transition-colors break-words ${value === opt
                  ? (darkMode ? 'bg-indigo-600/30 text-indigo-400 font-semibold' : 'bg-indigo-50 text-indigo-600 font-semibold')
                  : (darkMode ? 'hover:bg-slate-900 text-slate-200' : 'hover:bg-slate-50 text-slate-700')
                  }`}
              >
                {opt === 'Todos' ? 'Todos' : opt}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

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
      } catch (e) { }
    }
    return [
      { email: 'lucivaldo586@gmail.com', name: 'Lucivaldo Braga', role: 'admin', password: 'admin123' }
    ];
  });

  useEffect(() => {
    localStorage.setItem('afi_usuarios', JSON.stringify(usuariosAutorizados));
  }, [usuariosAutorizados]);

  // Estados Globais, Filtros e Temas
  const [darkMode, setDarkMode] = useState(true);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [busca, setBusca] = useState('');
  const [filtroAno, setFiltroAno] = useState('Todos');
  const [filtroCredor, setFiltroCredor] = useState('Todos');
  const [filtroNE, setFiltroNE] = useState('Todos');
  const [filtroProcesso, setFiltroProcesso] = useState('Todos');
  const [filtroUO, setFiltroUO] = useState('Todos');
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [buscaAuditoriaCredor, setBuscaAuditoriaCredor] = useState('');
  const [buscaAuditoriaNE, setBuscaAuditoriaNE] = useState('');
  const [filtroAuditoriaStatus, setFiltroAuditoriaStatus] = useState('Todos');
  const [exportandoPDF, setExportandoPDF] = useState(false);

  // Modal de Alertas Customizado
  const [alertModal, setAlertModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'info', // 'success', 'error', 'warning', 'info', 'confirm'
    onConfirm: null
  });

  const customAlert = (title, message, type = 'info') => {
    setAlertModal({
      show: true,
      title,
      message,
      type,
      onConfirm: null
    });
  };

  const customConfirm = (title, message, onConfirm) => {
    setAlertModal({
      show: true,
      title,
      message,
      type: 'confirm',
      onConfirm
    });
  };

  // Cadastro e Edição de Usuário
  const [novoEmail, setNovoEmail] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoCargo, setNovoCargo] = useState('viewer');
  const [novaSenha, setNovaSenha] = useState('');
  const [novoSetor, setNovoSetor] = useState('');
  const [editingEmail, setEditingEmail] = useState(null);

  const cadastrarUsuario = (e) => {
    e.preventDefault();
    if (!novoEmail || !novoNome || !novaSenha) return;

    if (editingEmail) {
      setUsuariosAutorizados(prev => prev.map(u =>
        u.email === editingEmail ? { ...u, name: novoNome, email: novoEmail, password: novaSenha, role: novoCargo, setor: novoSetor } : u
      ));
      customAlert("Sucesso", `Usuário ${novoNome} atualizado com sucesso!`, "success");
      setEditingEmail(null);
    } else {
      if (usuariosAutorizados.some(u => u.email === novoEmail)) {
        customAlert("Aviso", "E-mail já cadastrado!", "warning");
        return;
      }
      setUsuariosAutorizados(prev => [...prev, { email: novoEmail, name: novoNome, password: novaSenha, role: novoCargo, setor: novoSetor }]);
      customAlert("Sucesso", `Usuário ${novoNome} cadastrado com sucesso!`, "success");
    }

    setNovoEmail('');
    setNovoNome('');
    setNovaSenha('');
    setNovoCargo('viewer');
    setNovoSetor('');
  };

  const iniciarEdicao = (usr) => {
    setEditingEmail(usr.email);
    setNovoNome(usr.name);
    setNovoEmail(usr.email);
    setNovaSenha(usr.password || '123456');
    setNovoCargo(usr.role);
    setNovoSetor(usr.setor || '');
  };

  const removerUsuario = (email) => {
    if (email === 'lucivaldo586@gmail.com') {
      customAlert("Aviso", "Não é possível remover o administrador padrão!", "warning");
      return;
    }
    customConfirm(
      "Remover Usuário",
      `Deseja realmente remover o acesso do usuário ${email}?`,
      () => {
        setUsuariosAutorizados(prev => prev.filter(u => u.email !== email));
      }
    );
  };

  // Monitorar Autenticação do Firebase
  useEffect(() => {
    const unsubscribe = firebaseService.onAuthChange((currentUser) => {
      if (currentUser) {
        const dadosLocais = usuariosAutorizados.find(u => u.email.toLowerCase() === currentUser.email.toLowerCase());
        setUser({
          email: currentUser.email,
          name: dadosLocais ? dadosLocais.name : (currentUser.displayName || currentUser.email.split('@')[0]),
          role: currentUser.email === 'lucivaldo586@gmail.com' ? 'admin' : (dadosLocais ? dadosLocais.role : 'viewer')
        });
        setIsAuthenticated(true);
        carregarDadosFirebase();
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, [usuariosAutorizados]);

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

  // Forçar tema escuro permanentemente
  useEffect(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }, []);

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
            customAlert("Erro", "Nenhum registro encontrado ou formato de planilha inválido.", "error");
            setLoadingFirebase(false);
            return;
          }

          await firebaseService.adicionarRegistros(registros, file.name);
          customAlert("Sucesso", `Planilha processada com sucesso! ${registros.length} empenhos importados.`, "success");
          await carregarDadosFirebase();
        } catch (err) {
          console.error(err);
          customAlert("Erro", "Erro ao processar planilha: " + err.message, "error");
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
    customConfirm(
      "Remover Arquivo",
      `Tem certeza que deseja remover o arquivo "${nomeOriginal}" e todos os seus empenhos do sistema?`,
      async () => {
        setLoadingFirebase(true);
        try {
          await firebaseService.removerArquivo(nomeOriginal);
        } catch (err) {
          console.warn("Removendo localmente.");
        }
        setArquivos(prev => prev.filter(a => a.nome_original !== nomeOriginal));
        setDados(prev => prev.filter(d => d.arquivo_origem !== nomeOriginal));
        setLoadingFirebase(false);
      }
    );
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
    const bateCredor = filtroCredor === 'Todos' || !filtroCredor || item.Credor.toLowerCase().includes(filtroCredor.toLowerCase());
    const bateNE = filtroNE === 'Todos' || !filtroNE || item.Num_NE.toLowerCase().includes(filtroNE.toLowerCase());
    const bateProcesso = filtroProcesso === 'Todos' || !filtroProcesso || item.Processo.toLowerCase().includes(filtroProcesso.toLowerCase());
    const bateUO = filtroUO === 'Todos' || !filtroUO || item.UO.toLowerCase().includes(filtroUO.toLowerCase());

    return bateBusca && bateAno && bateCredor && bateNE && bateProcesso && bateUO;
  });

  // Filtrar opções de cada seletor com base nas outras seleções
  const dadosParaAnos = dados.filter(item => {
    const bateCredor = filtroCredor === 'Todos' || !filtroCredor || item.Credor.toLowerCase().includes(filtroCredor.toLowerCase());
    const bateNE = filtroNE === 'Todos' || !filtroNE || item.Num_NE.toLowerCase().includes(filtroNE.toLowerCase());
    const bateProcesso = filtroProcesso === 'Todos' || !filtroProcesso || item.Processo.toLowerCase().includes(filtroProcesso.toLowerCase());
    const bateUO = filtroUO === 'Todos' || !filtroUO || item.UO.toLowerCase().includes(filtroUO.toLowerCase());
    return bateCredor && bateNE && bateProcesso && bateUO;
  });

  const dadosParaCredores = dados.filter(item => {
    const bateAno = filtroAno === 'Todos' || item.Ano_Processo === filtroAno;
    const bateNE = filtroNE === 'Todos' || !filtroNE || item.Num_NE.toLowerCase().includes(filtroNE.toLowerCase());
    const bateProcesso = filtroProcesso === 'Todos' || !filtroProcesso || item.Processo.toLowerCase().includes(filtroProcesso.toLowerCase());
    const bateUO = filtroUO === 'Todos' || !filtroUO || item.UO.toLowerCase().includes(filtroUO.toLowerCase());
    return bateAno && bateNE && bateProcesso && bateUO;
  });

  const dadosParaNEs = dados.filter(item => {
    const bateAno = filtroAno === 'Todos' || item.Ano_Processo === filtroAno;
    const bateCredor = filtroCredor === 'Todos' || !filtroCredor || item.Credor.toLowerCase().includes(filtroCredor.toLowerCase());
    const bateProcesso = filtroProcesso === 'Todos' || !filtroProcesso || item.Processo.toLowerCase().includes(filtroProcesso.toLowerCase());
    const bateUO = filtroUO === 'Todos' || !filtroUO || item.UO.toLowerCase().includes(filtroUO.toLowerCase());
    return bateAno && bateCredor && bateProcesso && bateUO;
  });

  const dadosParaProcessos = dados.filter(item => {
    const bateAno = filtroAno === 'Todos' || item.Ano_Processo === filtroAno;
    const bateCredor = filtroCredor === 'Todos' || !filtroCredor || item.Credor.toLowerCase().includes(filtroCredor.toLowerCase());
    const bateNE = filtroNE === 'Todos' || !filtroNE || item.Num_NE.toLowerCase().includes(filtroNE.toLowerCase());
    const bateUO = filtroUO === 'Todos' || !filtroUO || item.UO.toLowerCase().includes(filtroUO.toLowerCase());
    return bateAno && bateCredor && bateNE && bateUO;
  });

  const dadosParaUOs = dados.filter(item => {
    const bateAno = filtroAno === 'Todos' || item.Ano_Processo === filtroAno;
    const bateCredor = filtroCredor === 'Todos' || !filtroCredor || item.Credor.toLowerCase().includes(filtroCredor.toLowerCase());
    const bateNE = filtroNE === 'Todos' || !filtroNE || item.Num_NE.toLowerCase().includes(filtroNE.toLowerCase());
    const bateProcesso = filtroProcesso === 'Todos' || !filtroProcesso || item.Processo.toLowerCase().includes(filtroProcesso.toLowerCase());
    return bateAno && bateCredor && bateNE && bateProcesso;
  });

  const anosDisponiveis = ['Todos', ...new Set(dadosParaAnos.map(item => item.Ano_Processo))].sort();
  const credoresDisponiveis = ['Todos', ...new Set(dadosParaCredores.map(item => item.Credor))].sort();
  const neDisponiveis = ['Todos', ...new Set(dadosParaNEs.map(item => item.Num_NE))].sort();
  const processosDisponiveis = ['Todos', ...new Set(dadosParaProcessos.map(item => item.Processo))].sort();
  const uoDisponiveis = ['Todos', ...new Set(dadosParaUOs.map(item => item.UO))].sort();

  // Data de referência de Hoje (dinâmica sem fallback)
  const dataHojeRef = (() => {
    const hojeSistema = new Date();
    const dia = String(hojeSistema.getDate()).padStart(2, '0');
    const mes = String(hojeSistema.getMonth() + 1).padStart(2, '0');
    const ano = hojeSistema.getFullYear();
    return `${dia}/${mes}/${ano}`;
  })();

  const empenhosHoje = dadosFiltrados.filter(item => item.Data_Emis === dataHojeRef);
  const valorHoje = empenhosHoje.reduce((sum, item) => sum + item.Pago_Acum, 0);
  const empenhadoHojeTotal = empenhosHoje.reduce((sum, item) => sum + item.Emp_Acum, 0);
  const aPagarHojeTotal = empenhosHoje.reduce((sum, item) => sum + item.A_Pagar, 0);
  const aLiquidarHojeTotal = empenhosHoje.reduce((sum, item) => sum + item.A_Liquidar, 0);

  // Identificar empenhos sob risco para avisos visuais
  const empenhosRisco = dadosFiltrados.filter(item => item.A_Pagar > 100000 || item.A_Liquidar > 200000);
  const totalRiscoValor = empenhosRisco.reduce((sum, item) => sum + item.A_Pagar + item.A_Liquidar, 0);

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

  const exportarPDF = async () => {
    setExportandoPDF(true);
    
    // Alerta customizado de início
    const loadingAlert = document.createElement('div');
    loadingAlert.style.position = 'fixed';
    loadingAlert.style.top = '20px';
    loadingAlert.style.right = '20px';
    loadingAlert.style.zIndex = '9999';
    loadingAlert.style.backgroundColor = '#4f46e5';
    loadingAlert.style.color = '#ffffff';
    loadingAlert.style.padding = '12px 24px';
    loadingAlert.style.borderRadius = '12px';
    loadingAlert.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    loadingAlert.style.fontFamily = 'Outfit, sans-serif';
    loadingAlert.style.fontSize = '12px';
    loadingAlert.style.fontWeight = 'bold';
    loadingAlert.innerText = 'Gerando relatório PDF estruturado...';
    document.body.appendChild(loadingAlert);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const drawHeader = (titulo, pageNum, totalPages) => {
        // Cor de fundo geral do relatório baseada no tema
        pdf.setFillColor(255, 255, 255); // Usar branco no PDF para impressão profissional
        pdf.rect(0, 0, 210, 297, 'F');
        
        // Cabeçalho institucional (faixa superior)
        pdf.setFillColor(79, 70, 229); // indigo-600
        pdf.rect(0, 0, 210, 22, 'F');
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(255, 255, 255);
        pdf.text("CETAM - CENTRO DE EDUCAÇÃO TECNOLÓGICA DO AMAZONAS", 12, 10);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text("DAF - DIRETORIA ADMINISTRATIVO FINANCEIRA", 12, 15);
        
        // Linha divisória
        pdf.setDrawColor(229, 231, 235);
        pdf.setLineWidth(0.5);
        pdf.line(10, 36, 200, 36);
        
        // Título da Página
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(15, 23, 42); // slate-900
        pdf.text(titulo, 12, 30);
        
        // Rodapé
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(156, 163, 175);
        pdf.text(`Emitido em: ${new Date().toLocaleString()} • Por: ${user?.name || 'Administrador'}`, 12, 288);
        pdf.text(`Página ${pageNum} de ${totalPages}`, 180, 288);
      };

      const getChartImage = async (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const canvas = await html2canvas(el, {
          scale: 2.2,
          useCORS: true,
          backgroundColor: '#ffffff' // Fundo branco no PDF para melhor impressão
        });
        return canvas.toDataURL('image/png');
      };

      if (currentPage === 'dashboard') {
        const totalPaginas = 3;
        
        // PAGINA 1: Resumo Executivo e KPIs
        drawHeader("RELATÓRIO DE EXECUÇÃO ORÇAMENTÁRIA - RESUMO", 1, totalPaginas);
        
        // Escrever Metadados dos Filtros
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105);
        pdf.text("Filtros Ativos:", 12, 43);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Exercício: ${filtroAno}  |  Credor: ${filtroCredor}  |  NE: ${filtroNE}  |  Processo: ${filtroProcesso}  |  UO: ${filtroUO}`, 12, 48);

        // Desenhar Tabela de KPIs (Vetorizada)
        let startY = 56;
        pdf.setFillColor(79, 70, 229); // cabeçalho da tabela
        pdf.rect(12, startY, 186, 7, 'F');
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        pdf.text("CATEGORIA", 15, startY + 5);
        pdf.text("VALOR NO MÊS", 85, startY + 5);
        pdf.text("ACUMULADO / SALDO", 145, startY + 5);

        const kpisData = [
          { name: "Despesa Empenhada", mes: totais.empMes, acum: totais.empAcum, color: [79, 70, 229] },
          { name: "Despesa Liquidada", mes: totais.liqMes, acum: totais.liqAcum, color: [139, 92, 246] },
          { name: "Despesa Paga", mes: totais.pagoMes, acum: totais.pagoAcum, color: [16, 185, 129] },
          { name: "A Liquidar (Saldo)", mes: 0, acum: totais.aLiquidar, color: [245, 158, 11] },
          { name: "A Pagar (Saldo)", mes: 0, acum: totais.aPagar, color: [239, 68, 68] }
        ];

        let currY = startY + 7;
        kpisData.forEach((row, idx) => {
          pdf.setFillColor(idx % 2 === 0 ? 249 : 243, idx % 2 === 0 ? 250 : 244, idx % 2 === 0 ? 251 : 246);
          pdf.rect(12, currY, 186, 8, 'F');
          
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8);
          pdf.setTextColor(31, 41, 55);
          pdf.text(row.name, 15, currY + 5.5);
          
          pdf.setFont("helvetica", "normal");
          pdf.text(row.mes > 0 ? formatarMoeda(row.mes) : "-", 85, currY + 5.5);
          
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(row.color[0], row.color[1], row.color[2]);
          pdf.text(formatarMoeda(row.acum), 145, currY + 5.5);
          
          currY += 8;
        });

        // Adicionar Resumo das Operações do Dia
        currY += 8;
        pdf.setFillColor(239, 246, 255); // azul sutil
        pdf.rect(12, currY, 186, 20, 'F');
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.setTextColor(37, 99, 235);
        pdf.text(`MOVIMENTAÇÕES PROGRAMADAS PARA HOJE (${dataHojeRef})`, 15, currY + 5);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(51, 65, 85);
        pdf.text(`Total Pago Hoje: ${formatarMoeda(valorHoje)}   |   Total Empenhado: ${formatarMoeda(empenhadoHojeTotal)}`, 15, currY + 11);
        pdf.text(`Saldo A Liquidar: ${formatarMoeda(aLiquidarHojeTotal)}   |   Saldo A Pagar: ${formatarMoeda(aPagarHojeTotal)}`, 15, currY + 16);

        // Inserir Gráfico de Hoje se houver registros
        const imgHoje = await getChartImage('grafico-hoje');
        if (imgHoje) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          pdf.setTextColor(15, 23, 42);
          pdf.text("Detalhamento Gráfico das Movimentações do Dia", 12, currY + 28);
          pdf.addImage(imgHoje, 'PNG', 12, currY + 31, 186, 95);
        }

        // PAGINA 2: Evolução e Exercícios
        pdf.addPage();
        drawHeader("ANÁLISE DE EVOLUÇÃO E ORÇAMENTO POR EXERCÍCIO", 2, totalPaginas);

        const imgEvolucao = await getChartImage('grafico-evolucao');
        if (imgEvolucao) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          pdf.setTextColor(15, 23, 42);
          pdf.text("Evolução Mensal (Empenhado vs Pago)", 12, 42);
          pdf.addImage(imgEvolucao, 'PNG', 12, 45, 186, 95);
        }

        const imgExercicios = await getChartImage('grafico-exercicio');
        if (imgExercicios) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          pdf.setTextColor(15, 23, 42);
          pdf.text("Total Pago vs Empenhado por Exercício", 12, 155);
          pdf.addImage(imgExercicios, 'PNG', 12, 158, 186, 95);
        }

        // PAGINA 3: Maiores Credores e Maiores UOs
        pdf.addPage();
        drawHeader("MAIORES CONTRATADOS E UNIDADES ORÇAMENTÁRIAS", 3, totalPaginas);

        const imgCredores = await getChartImage('grafico-credores');
        if (imgCredores) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          pdf.setTextColor(15, 23, 42);
          pdf.text("Maiores Contratados por Volume de Empenhos", 12, 42);
          pdf.addImage(imgCredores, 'PNG', 12, 45, 186, 105);
        }

        const imgUos = await getChartImage('grafico-uos');
        if (imgUos) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          pdf.setTextColor(15, 23, 42);
          pdf.text("Maiores Despesas por Unidade Orçamentária (UO)", 12, 160);
          pdf.addImage(imgUos, 'PNG', 12, 163, 186, 105);
        }

      } else if (currentPage === 'avancados') {
        const totalPaginas = 1;
        drawHeader("ANÁLISE AVANÇADA, EXECUÇÃO E NATUREZAS", 1, totalPaginas);

        // Execução Geral e Funil Lado a Lado
        const imgGauge = await getChartImage('grafico-gauge');
        if (imgGauge) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          pdf.setTextColor(15, 23, 42);
          pdf.text("Percentual de Execução Geral", 12, 43);
          pdf.addImage(imgGauge, 'PNG', 12, 46, 88, 55);
        }

        const imgFunil = await getChartImage('grafico-funil');
        if (imgFunil) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          pdf.setTextColor(15, 23, 42);
          pdf.text("Funil Orçamentário", 110, 43);
          pdf.addImage(imgFunil, 'PNG', 110, 46, 88, 55);
        }

        // Gráfico de Naturezas de Despesa
        const imgNatureza = await getChartImage('grafico-natureza');
        if (imgNatureza) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          pdf.setTextColor(15, 23, 42);
          pdf.text("Empenhos por Natureza de Despesa", 12, 125);
          pdf.addImage(imgNatureza, 'PNG', 12, 128, 186, 110);
        }
      } else {
        // Print simples formatado
        drawHeader(`RELATÓRIO - ${currentPage.toUpperCase()}`, 1, 1);
        const input = document.getElementById('dashboard-view');
        const canvas = await html2canvas(input, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 12, 42, 186, (canvas.height * 186) / canvas.width);
      }

      pdf.save(`relatorio_${currentPage}_${filtroAno}.pdf`);
      
      // Remover alerta
      if (loadingAlert.parentNode) {
        loadingAlert.parentNode.removeChild(loadingAlert);
      }
      customAlert("Sucesso", "O relatório PDF foi gerado e baixado com sucesso!", "success");
    } catch (err) {
      console.error("Erro na exportação para PDF:", err);
      if (loadingAlert.parentNode) {
        loadingAlert.parentNode.removeChild(loadingAlert);
      }
      customAlert("Erro", "Não foi possível gerar o PDF. Verifique o console.", "error");
    } finally {
      setExportandoPDF(false);
    }
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

  const despesasPorNatureza = (() => {
    const raw = dadosFiltrados.reduce((acc, item) => {
      const nat = item.Natureza.split(' - ')[0];
      const existente = acc.find(x => x.name === nat);
      if (existente) {
        existente.value += item.Emp_Acum;
      } else {
        acc.push({ name: nat, value: item.Emp_Acum });
      }
      return acc;
    }, []);

    raw.sort((a, b) => b.value - a.value);

    if (raw.length > 6) {
      const top = raw.slice(0, 5);
      const rest = raw.slice(5);
      const restTotal = rest.reduce((sum, x) => sum + x.value, 0);
      return [...top, { name: 'Outras Naturezas', value: restTotal }];
    }
    return raw;
  })();

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
    .map(x => ({ name: x.Credor, Empenhado: x.Emp_Acum, Pago: x.Pago_Acum }));

  const chartDadosHoje = empenhosHoje
    .sort((a, b) => b.Emp_Acum - a.Emp_Acum)
    .map(x => ({
      name: x.Credor,
      Empenhado: x.Emp_Acum,
      Pago: x.Pago_Acum
    }));

  const despesasPorUO = dadosFiltrados.reduce((acc, item) => {
    const uo = item.UO || "Sem UO";
    const existente = acc.find(x => x.name === uo);
    if (existente) {
      existente.Empenhado += item.Emp_Acum;
      existente.Pago += item.Pago_Acum;
    } else {
      acc.push({ name: uo.length > 25 ? uo.substring(0, 25) + '...' : uo, Empenhado: item.Emp_Acum, Pago: item.Pago_Acum });
    }
    return acc;
  }, []).sort((a, b) => b.Empenhado - a.Empenhado);

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
            <img
              src={logoImg}
              alt="Logo CETAM"
              className="w-16 h-16 rounded-2xl object-contain shadow-xl shadow-indigo-600/10 mb-3"
            />
            <h2 className="text-lg font-extrabold tracking-wider uppercase text-center text-slate-200 mt-2">PAINEL DE GESTÃO ORÇAMENTÁRIA</h2>
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
    <div className={`min-h-screen flex transition-colors duration-300 ${darkMode ? 'custom-bg-dark text-slate-100' : 'custom-bg-light text-slate-800'}`}>

      {/* Sidebar Fixo Lateral */}
      <aside className={`w-72 flex-shrink-0 border-r ${darkMode ? 'custom-sidebar-dark text-slate-200' : 'custom-sidebar-light text-slate-800'} p-6 flex flex-col`}>
        <div>
          {/* Logo e Nome Centralizados */}
          <div className="flex flex-col items-center text-center gap-2 mb-8">
            <img
              src={logoImg}
              alt="Logo CETAM"
              className="w-16 h-16 rounded-2xl object-contain shadow-lg"
            />
            <div>
              <h1 className="font-extrabold text-lg leading-tight tracking-wide">CETAM</h1>
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400 dark:text-slate-500 block mt-0.5">DAF</span>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-full transition-all text-sm font-semibold ${currentPage === 'dashboard' ? 'm3-nav-item-active' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-850 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-slate-200'}`}
            >
              <LayoutDashboard size={18} /> Dashboard Geral
            </button>
            <button
              onClick={() => setCurrentPage('avancados')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-full transition-all text-sm font-semibold ${currentPage === 'avancados' ? 'm3-nav-item-active' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-850 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-slate-200'}`}
            >
              <TrendingUp size={18} /> Visuais Avançados
            </button>
            <button
              onClick={() => setCurrentPage('auditoria')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-full transition-all text-sm font-semibold ${currentPage === 'auditoria' ? 'm3-nav-item-active' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-850 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-slate-200'}`}
            >
              <AlertTriangle size={18} /> Matriz de Gargalos
            </button>
            <button
              onClick={() => setCurrentPage('upload')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-full transition-all text-sm font-semibold ${currentPage === 'upload' ? 'm3-nav-item-active' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-850 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-slate-200'}`}
            >
              <Upload size={18} /> Upload e Histórico
            </button>
            {user?.email === 'lucivaldo586@gmail.com' && (
              <button
                onClick={() => setCurrentPage('usuarios')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-full transition-all text-sm font-semibold ${currentPage === 'usuarios' ? 'm3-nav-item-active' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-850 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-slate-200'}`}
              >
                <Users size={18} /> Gerenciar Usuários
              </button>
            )}
          </nav>

          {/* Sincronismo e Usuário integrado abaixo do menu */}
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
            {/* Sincronismo */}
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-3">
              <span className="uppercase tracking-wider">Sincronismo</span>
              <button onClick={carregarDadosFirebase} className="hover:text-indigo-500 dark:hover:text-indigo-400 transition" title="Carregar Dados">
                <RefreshCw size={12} className={loadingFirebase ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Informações do Usuário (Sem foto de perfil) */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50">
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{user?.name}</p>
                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block mt-0.5">Administrador</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition flex-shrink-0"
                title="Sair"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 overflow-y-auto p-10 font-sans" id="dashboard-view">

        {/* Topbar Header */}
        <header className="flex justify-between items-center mb-8 max-w-7xl mx-auto w-full">
          <div>
            <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">DAF - DIRETORIA ADMINISTRATIVO FINANCEIRO</span>
            <h2 className="text-3xl font-extrabold tracking-tight">Painel de Execução Orçamentária </h2>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto hide-in-pdf">
            {!exportandoPDF && (
              <button onClick={exportarPDF} className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold shadow transition"><FileDown size={16} /> Exportar PDF</button>
            )}
            <button onClick={exportarXLS} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow transition"><Download size={16} /> Exportar Excel</button>
          </div>
        </header>

        {dados.length === 0 && currentPage !== 'upload' && currentPage !== 'usuarios' ? (
          <div className={`p-10 rounded-2xl border text-center flex flex-col items-center justify-center ${darkMode ? 'custom-card-dark' : 'custom-card-light'}`}>
            <AlertCircle size={40} className="text-amber-500 mb-3" />
            <h3 className="text-lg font-bold mb-1">Nenhum dado orçamentário ativo</h3>
            <p className="text-xs text-slate-400 mb-6 max-w-sm">Para visualizar gráficos e KPIs, faça o upload da planilha extraída do AFI, em extensão .xls ou .xlsx</p>
            <button onClick={() => setCurrentPage('upload')} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition">Ir para Upload</button>
          </div>
        ) : (
          <>
            {/* Dashboard Geral */}
            {currentPage === 'dashboard' && (
              <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto w-full">

                <div className={`p-6 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm space-y-4`}>
                  {/* Busca Geral */}
                  <div className="relative">
                    <Search className="absolute left-4 top-3 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Pesquisa geral em Credor, NE, Processo, Natureza ou UO..."
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      className={`w-full pl-11 pr-4 py-2.5 rounded-xl border outline-none text-sm transition ${darkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500 placeholder-slate-600' : 'bg-slate-50 border-slate-200 focus:border-indigo-500 placeholder-slate-400'}`}
                    />
                  </div>

                  {/* Grid de 5 Filtros Específicos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                    {/* Exercício */}
                    <div className="flex flex-col text-left">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Exercício</label>
                      <select
                        value={filtroAno}
                        onChange={(e) => setFiltroAno(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border outline-none text-xs transition ${darkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500'}`}
                      >
                        {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano === 'Todos' ? 'Todos os Anos' : ano}</option>)}
                      </select>
                    </div>

                    {/* Credor */}
                    <SearchableDropdown
                      label="Credor"
                      value={filtroCredor}
                      onChange={setFiltroCredor}
                      options={credoresDisponiveis}
                      placeholder="Todos os Credores"
                      darkMode={darkMode}
                    />

                    {/* NE */}
                    <SearchableDropdown
                      label="Número da NE"
                      value={filtroNE}
                      onChange={setFiltroNE}
                      options={neDisponiveis}
                      placeholder="Todas as NEs"
                      darkMode={darkMode}
                    />

                    {/* Processo */}
                    <SearchableDropdown
                      label="Processo"
                      value={filtroProcesso}
                      onChange={setFiltroProcesso}
                      options={processosDisponiveis}
                      placeholder="Todos os Processos"
                      darkMode={darkMode}
                    />

                    {/* UO */}
                    <SearchableDropdown
                      label="Unidade (UO)"
                      value={filtroUO}
                      onChange={setFiltroUO}
                      options={uoDisponiveis}
                      placeholder="Todas as UOs"
                      darkMode={darkMode}
                    />
                  </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className={`p-5 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm flex flex-col items-center justify-center text-center`}>
                    <span className="text-xs font-semibold text-slate-400">Empenhado no Mês</span>
                    <p className="text-xl font-extrabold tracking-tight mt-1">{formatarMoeda(totais.empMes)}</p>
                  </div>
                  <div className={`p-5 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm flex flex-col items-center justify-center text-center`}>
                    <span className="text-xs font-semibold text-slate-400">Empenhado Mês (Acumulado)</span>
                    <p className="text-xl font-extrabold tracking-tight mt-1 text-indigo-500">{formatarMoeda(totais.empAcum)}</p>
                  </div>
                  <div className={`p-5 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm flex flex-col items-center justify-center text-center`}>
                    <span className="text-xs font-semibold text-slate-400">Liquidado no Mês</span>
                    <p className="text-xl font-extrabold tracking-tight mt-1">{formatarMoeda(totais.liqMes)}</p>
                  </div>
                  <div className={`p-5 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm flex flex-col items-center justify-center text-center`}>
                    <span className="text-xs font-semibold text-slate-400">Liquidado Mês (Acumulado)</span>
                    <p className="text-xl font-extrabold tracking-tight mt-1 text-purple-500">{formatarMoeda(totais.liqAcum)}</p>
                  </div>
                  <div className={`p-5 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm flex flex-col items-center justify-center text-center`}>
                    <span className="text-xs font-semibold text-slate-400">A Liquidar</span>
                    <p className="text-xl font-extrabold tracking-tight mt-1 text-amber-500">{formatarMoeda(totais.aLiquidar)}</p>
                  </div>
                  <div className={`p-5 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm flex flex-col items-center justify-center text-center`}>
                    <span className="text-xs font-semibold text-slate-400">Pago no Mês</span>
                    <p className="text-xl font-extrabold tracking-tight mt-1">{formatarMoeda(totais.pagoMes)}</p>
                  </div>
                  <div className={`p-5 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm flex flex-col items-center justify-center text-center`}>
                    <span className="text-xs font-semibold text-slate-400">Pago Mês (Acumulado)</span>
                    <p className="text-xl font-extrabold tracking-tight mt-1 text-emerald-500">{formatarMoeda(totais.pagoAcum)}</p>
                  </div>
                  <div className={`p-5 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm flex flex-col items-center justify-center text-center`}>
                    <span className="text-xs font-semibold text-slate-400">A Pagar</span>
                    <p className="text-xl font-extrabold tracking-tight mt-1 text-rose-500">{formatarMoeda(totais.aPagar)}</p>
                  </div>
                </div>

                {/* Seção Operações de Hoje (No Topo dos Gráficos) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Card: Agendado para Hoje */}
                  <div className={`p-6 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm flex flex-col justify-between`}>
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base font-extrabold tracking-tight">Agendado para Hoje</h3>
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 rounded-lg text-[10px] font-bold">
                          Ref: {dataHojeRef}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mb-6">Detalhamento dos valores liberados e empenhados na data atual de processamento.</p>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-xs text-slate-400">Total Pago Hoje</span>
                          <span className="text-sm font-extrabold text-emerald-500">{formatarMoeda(valorHoje)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-xs text-slate-400">Total Empenhado</span>
                          <span className="text-sm font-extrabold text-indigo-500">{formatarMoeda(empenhadoHojeTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-xs text-slate-400">A Liquidar</span>
                          <span className="text-sm font-semibold text-amber-500">{formatarMoeda(aLiquidarHojeTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-xs text-slate-400">A Pagar</span>
                          <span className="text-sm font-semibold text-rose-500">{formatarMoeda(aPagarHojeTotal)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 mt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                      <span className="text-xs text-slate-400 font-semibold">Qtd. Empenhos</span>
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-bold">
                        {empenhosHoje.length} registros
                      </span>
                    </div>
                  </div>

                  {/* Gráfico: Empenhos para a Data de Hoje */}
                  <div className={`p-6 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm lg:col-span-2`}>
                    <h3 className="text-base font-extrabold tracking-tight mb-4">Empenhos para a Data de Hoje</h3>
                    <div className="h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800" style={{ minHeight: '250px', minWidth: '0' }} id="grafico-hoje">
                      {empenhosHoje.length > 0 ? (
                        <div style={{ height: `${Math.max(250, chartDadosHoje.length * 45)}px` }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartDadosHoje} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1e293b" : "#e2e8f0"} />
                              <XAxis type="number" tickFormatter={formatarEixoMoeda} stroke={darkMode ? "#94a3b8" : "#64748b"} style={{ fontSize: '10px', fontFamily: 'Outfit, sans-serif' }} />
                              <YAxis dataKey="name" type="category" stroke={darkMode ? "#94a3b8" : "#64748b"} width={170} style={{ fontSize: '9px', fontFamily: 'Outfit, sans-serif' }} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                                  borderColor: darkMode ? '#1e293b' : '#e2e8f0',
                                  borderRadius: '12px',
                                  fontFamily: 'Outfit, sans-serif',
                                  fontSize: '11px',
                                  color: darkMode ? '#f8fafc' : '#0f172a'
                                }}
                                formatter={(value) => [formatarMoeda(value), '']}
                              />
                              <Legend wrapperStyle={{ fontFamily: 'Outfit, sans-serif', fontSize: '10px' }} />
                              <Bar dataKey="Empenhado" fill="#6366f1" radius={[0, 4, 4, 0]} />
                              <Bar dataKey="Pago" fill="#10b981" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-slate-400">
                          Nenhuma movimentação para esta data.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tabela de Empenhos de Hoje */}
                  <div className={`p-6 rounded-2xl border lg:col-span-3 ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm`}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-base font-extrabold tracking-tight">Detalhamento dos Empenhos do Dia</h3>
                      <span className="text-[10px] text-slate-400 font-semibold">Movimentações de Hoje ({dataHojeRef})</span>
                    </div>

                    <div className="overflow-x-auto max-h-60 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <th className="py-2 text-[10px] uppercase font-bold text-slate-400">Credor</th>
                            <th className="py-2 text-[10px] uppercase font-bold text-slate-400">Num NE</th>
                            <th className="py-2 text-[10px] uppercase font-bold text-slate-400 text-right">Empenhado</th>
                            <th className="py-2 text-[10px] uppercase font-bold text-slate-400 text-right">Pago</th>
                          </tr>
                        </thead>
                        <tbody>
                          {empenhosHoje.length > 0 ? (
                            empenhosHoje.map((item, idx) => (
                              <tr key={idx} className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800/10 text-xs">
                                <td className="py-2.5 font-semibold truncate max-w-xs">{item.Credor}</td>
                                <td className="py-2.5 text-slate-500 font-mono">{item.Num_NE}</td>
                                <td className="py-2.5 font-bold text-right text-indigo-500">{formatarMoeda(item.Emp_Acum)}</td>
                                <td className="py-2.5 font-bold text-right text-emerald-500">{formatarMoeda(item.Pago_Acum)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="4" className="py-8 text-center text-xs text-slate-400">Nenhum registro para hoje.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Graficos Gerais (Abaixo da Seção de Hoje) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className={`p-6 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm`}>
                    <h3 className="text-base font-bold mb-4">Evolução Mensal (Empenhado vs Pago)</h3>
                    <div className="h-80" style={{ minHeight: '320px', minWidth: '0' }} id="grafico-evolucao">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dataEvolucaoMensal}>
                          <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#334155" : "#e2e8f0"} />
                          <XAxis dataKey="name" stroke={darkMode ? "#94a3b8" : "#64748b"} style={{ fontSize: '10px', fontFamily: 'Outfit, sans-serif' }} />
                          <YAxis tickFormatter={formatarEixoMoeda} stroke={darkMode ? "#94a3b8" : "#64748b"} style={{ fontSize: '10px', fontFamily: 'Outfit, sans-serif' }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                              borderColor: darkMode ? '#1e293b' : '#e2e8f0',
                              borderRadius: '12px',
                              fontFamily: 'Outfit, sans-serif',
                              fontSize: '11px',
                              color: darkMode ? '#f8fafc' : '#0f172a'
                            }}
                            formatter={(value) => [formatarMoeda(value), '']}
                          />
                          <Legend wrapperStyle={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px' }} />
                          <Line type="monotone" dataKey="Empenhado" stroke="#6366f1" strokeWidth={3} />
                          <Line type="monotone" dataKey="Pago" stroke="#10b981" strokeWidth={3} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className={`p-6 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm`}>
                    <h3 className="text-base font-bold mb-4">Total Pago vs Empenhado por Exercício</h3>
                    <div className="h-80" style={{ minHeight: '320px', minWidth: '0' }} id="grafico-exercicio">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={totalPorAno}>
                          <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#334155" : "#e2e8f0"} />
                          <XAxis dataKey="ano" stroke={darkMode ? "#94a3b8" : "#64748b"} style={{ fontSize: '10px', fontFamily: 'Outfit, sans-serif' }} />
                          <YAxis tickFormatter={formatarEixoMoeda} stroke={darkMode ? "#94a3b8" : "#64748b"} style={{ fontSize: '10px', fontFamily: 'Outfit, sans-serif' }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                              borderColor: darkMode ? '#1e293b' : '#e2e8f0',
                              borderRadius: '12px',
                              fontFamily: 'Outfit, sans-serif',
                              fontSize: '11px',
                              color: darkMode ? '#f8fafc' : '#0f172a'
                            }}
                            formatter={(value) => [formatarMoeda(value), '']}
                          />
                          <Legend wrapperStyle={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px' }} />
                          <Bar dataKey="Empenhado" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Pago" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className={`p-6 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm`}>
                    <h3 className="text-base font-bold mb-4">Maiores Orçamentos por Credor</h3>
                    <div className="h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800" style={{ minHeight: '320px', minWidth: '0' }} id="grafico-credores">
                      <div style={{ height: `${Math.max(320, maioresCredores.length * 45)}px` }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={maioresCredores} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#334155" : "#e2e8f0"} />
                            <XAxis type="number" tickFormatter={formatarEixoMoeda} stroke={darkMode ? "#94a3b8" : "#64748b"} style={{ fontSize: '10px', fontFamily: 'Outfit, sans-serif' }} />
                            <YAxis dataKey="name" type="category" stroke={darkMode ? "#94a3b8" : "#64748b"} width={170} style={{ fontSize: '9px', fontFamily: 'Outfit, sans-serif' }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                                borderColor: darkMode ? '#1e293b' : '#e2e8f0',
                                borderRadius: '12px',
                                fontFamily: 'Outfit, sans-serif',
                                fontSize: '11px',
                                color: darkMode ? '#f8fafc' : '#0f172a'
                              }}
                              formatter={(value) => [formatarMoeda(value), '']}
                            />
                            <Bar dataKey="Empenhado" fill="#ec4899" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className={`p-6 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm`}>
                    <h3 className="text-base font-bold mb-4">Maiores Gastos por Unidade Orçamentária (UO)</h3>
                    <div className="h-80 overflow-x-auto overflow-y-hidden pr-2 scrollbar-thin scrollbar-thumb-slate-800" style={{ minHeight: '320px', minWidth: '0' }} id="grafico-uos">
                      <div style={{ width: `${Math.max(450, despesasPorUO.length * 85)}px`, height: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={despesasPorUO}>
                            <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#334155" : "#e2e8f0"} />
                            <XAxis dataKey="name" stroke={darkMode ? "#94a3b8" : "#64748b"} style={{ fontSize: '9px', fontFamily: 'Outfit, sans-serif' }} />
                            <YAxis tickFormatter={formatarEixoMoeda} stroke={darkMode ? "#94a3b8" : "#64748b"} style={{ fontSize: '10px', fontFamily: 'Outfit, sans-serif' }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                                borderColor: darkMode ? '#1e293b' : '#e2e8f0',
                                borderRadius: '12px',
                                fontFamily: 'Outfit, sans-serif',
                                fontSize: '11px',
                                color: darkMode ? '#f8fafc' : '#0f172a'
                              }}
                              formatter={(value) => [formatarMoeda(value), '']}
                            />
                            <Legend wrapperStyle={{ fontFamily: 'Outfit, sans-serif', fontSize: '11px' }} />
                            <Bar dataKey="Empenhado" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Pago" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Visuais Avançados */}
            {currentPage === 'avancados' && (
              <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto w-full">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className={`p-6 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm col-span-2`}>
                    <h3 className="text-base font-bold mb-4">Empenhos por Natureza</h3>
                    <div className="h-80 flex flex-col md:flex-row items-center justify-around">
                      <div className="h-64 w-full md:w-3/5" id="grafico-natureza">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={despesasPorNatureza} 
                              cx="50%" 
                              cy="50%" 
                              innerRadius={45} 
                              outerRadius={65} 
                              paddingAngle={3} 
                              dataKey="value"
                              label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
                                const RADIAN = Math.PI / 180;
                                const radius = outerRadius + 15;
                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                return (
                                  <text
                                    x={x}
                                    y={y}
                                    fill={darkMode ? '#94a3b8' : '#475569'}
                                    textAnchor={x > cx ? 'start' : 'end'}
                                    dominantBaseline="central"
                                    className="text-[9px] font-bold"
                                  >
                                    {`${name} (${(percent * 100).toFixed(2)}%)`}
                                  </text>
                                );
                              }}
                              labelLine={{ stroke: darkMode ? '#475569' : '#cbd5e1', strokeWidth: 1 }}
                            >
                              {despesasPorNatureza.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(value) => [formatarMoeda(value), '']} />
                            <Legend 
                              verticalAlign="bottom" 
                              height={32} 
                              iconType="circle"
                              iconSize={6}
                              formatter={(value) => (
                                <span className="text-slate-600 dark:text-slate-400 text-[10px] font-bold">
                                  {value}
                                </span>
                              )}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-4 text-xs scrollbar-thin w-full md:w-2/5">
                        {despesasPorNatureza.map((entry, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-xs">{entry.name}: <strong className="text-slate-900 dark:text-slate-100">{formatarMoeda(entry.value)}</strong></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={`p-6 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm flex flex-col items-center justify-center`}>
                    <h3 className="text-base font-bold mb-2">Execução Geral</h3>
                    <div className="relative w-[320px] h-[160px] overflow-hidden mb-2 flex items-center justify-center" id="grafico-gauge">
                      <PieChart width={320} height={320} style={{ position: 'absolute', top: 0 }}>
                        <Pie
                          data={[
                            { value: Math.min(100, percentualExecucao), fill: '#4f46e5' },
                            { value: Math.max(0, 100 - Math.min(100, percentualExecucao)), fill: darkMode ? '#1e293b' : '#e2e8f0' }
                          ]}
                          cx={160}
                          cy={160}
                          startAngle={180}
                          endAngle={0}
                          innerRadius={110}
                          outerRadius={140}
                          dataKey="value"
                          stroke="none"
                        />
                      </PieChart>
                      <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end">
                        <span className="text-3xl font-extrabold text-slate-800 dark:text-white leading-none">{percentualExecucao.toFixed(2)}%</span>
                      </div>
                    </div>
                    {/* Contador de 0% a 100% abaixo do gráfico */}
                    <div className="flex justify-between w-[280px] text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-2">
                      <span>0.00%</span>
                      <span>100.00%</span>
                    </div>
                  </div>
                </div>

                <div className={`p-6 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm`}>
                  <h3 className="text-base font-bold mb-4">Funil Orçamentário</h3>
                  <div className="h-80" id="grafico-funil">
                    <ResponsiveContainer width="100%" height="100%">
                      <FunnelChart>
                        <Tooltip formatter={(value) => [formatarMoeda(value), '']} />
                        <Funnel dataKey="value" data={dataFunil} isAnimationActive>
                          {dataFunil.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                          <LabelList position="inside" dataKey="name" fill="#ffffff" stroke="none" style={{ fontWeight: 'bold', fontSize: '12px' }} />
                        </Funnel>
                      </FunnelChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legenda Customizada para o Funil */}
                  <div className="flex flex-wrap justify-center gap-6 mt-6 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#6366f1]"></div>
                      <span>Empenhado: <strong className="text-slate-800 dark:text-slate-200">{formatarMoeda(totais.empAcum)}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#8b5cf6]"></div>
                      <span>Liquidado: <strong className="text-slate-800 dark:text-slate-200">{formatarMoeda(totais.liqAcum)}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
                      <span>Pago: <strong className="text-slate-800 dark:text-slate-200">{formatarMoeda(totais.pagoAcum)}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Auditoria */}
            {currentPage === 'auditoria' && (() => {
              const dadosAuditoria = dadosFiltrados.filter(item => {
                const bateCredor = item.Credor.toLowerCase().includes(buscaAuditoriaCredor.toLowerCase());
                const bateNE = item.Num_NE.toLowerCase().includes(buscaAuditoriaNE.toLowerCase());

                const riscoGargalo = item.A_Pagar > 50000 || item.A_Liquidar > 100000;
                const bateStatus = filtroAuditoriaStatus === 'Todos' ||
                  (filtroAuditoriaStatus === 'Gargalo' && riscoGargalo) ||
                  (filtroAuditoriaStatus === 'Seguro' && !riscoGargalo);

                return bateCredor && bateNE && bateStatus;
              });

              return (
                <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto w-full">
                  <div className={`p-6 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm`}>
                    <h3 className="text-base font-bold mb-1">Matriz de Gargalos e Auditoria</h3>
                    <p className="text-xs text-slate-500 mb-6">Detalhamento dos Credores com empenhos sob risco ou gargalo de pagamento.</p>

                    {/* Filtros específicos de Auditoria */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 hide-in-pdf">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Buscar Credor</label>
                        <input
                          type="text"
                          placeholder="Filtrar por nome do Credor..."
                          value={buscaAuditoriaCredor}
                          onChange={(e) => setBuscaAuditoriaCredor(e.target.value)}
                          className={`w-full px-3 py-2.5 rounded-xl border outline-none text-xs ${darkMode ? 'bg-slate-950 border-slate-850 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500'}`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Buscar NE</label>
                        <input
                          type="text"
                          placeholder="Filtrar por número da NE..."
                          value={buscaAuditoriaNE}
                          onChange={(e) => setBuscaAuditoriaNE(e.target.value)}
                          className={`w-full px-3 py-2.5 rounded-xl border outline-none text-xs ${darkMode ? 'bg-slate-950 border-slate-850 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500'}`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Status</label>
                        <select
                          value={filtroAuditoriaStatus}
                          onChange={(e) => setFiltroAuditoriaStatus(e.target.value)}
                          className={`w-full px-3 py-2.5 rounded-xl border outline-none text-xs ${darkMode ? 'bg-slate-950 border-slate-850 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 focus:border-indigo-500'}`}
                        >
                          <option value="Todos">Todos os Status</option>
                          <option value="Gargalo">Apenas Gargalo</option>
                          <option value="Seguro">Apenas Seguro</option>
                        </select>
                      </div>
                    </div>

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
                          {dadosAuditoria.length > 0 ? (
                            dadosAuditoria.map((item, idx) => {
                              const riscoGargalo = item.A_Pagar > 50000 || item.A_Liquidar > 100000;
                              return (
                                <tr key={idx} className="border-b border-slate-50 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800/20 text-xs">
                                  <td className="py-3.5 font-bold truncate max-w-xs">{item.Credor}</td>
                                  <td className="py-3.5 font-mono">{item.Num_NE}</td>
                                  <td className="py-3.5 text-right text-amber-500 font-semibold">{formatarMoeda(item.A_Liquidar)}</td>
                                  <td className="py-3.5 text-right text-rose-500 font-semibold">{formatarMoeda(item.A_Pagar)}</td>
                                  <td className="py-3.5 text-center">
                                    {riscoGargalo ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">Gargalo</span> : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">Seguro</span>}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan="5" className="py-8 text-center text-xs text-slate-400">Nenhum empenho encontrado com os filtros aplicados.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* Upload de Relatórios (Sempre Disponível) */}
        {currentPage === 'upload' && (
          <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto w-full">
            <div className={`p-8 rounded-2xl border-2 border-dashed ${darkMode ? 'border-slate-800 bg-[rgba(15,23,42,0.4)]' : 'border-slate-200 bg-white'} text-center flex flex-col items-center justify-center`}>
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

            <div className={`p-6 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm`}>
              <h3 className="text-base font-bold mb-4">Arquivos Processados por Pandas</h3>
              {arquivos.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Nenhum arquivo enviado até o momento.</p>
              ) : (
                <div className="space-y-3">
                  {arquivos.map((arq, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-xs text-slate-800 dark:text-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600">
                          <FileSpreadsheet size={18} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-xs">{arq.nome_original}</h4>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">{arq.total_linhas} linhas extraídas • {arq.processado_em}</span>
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
          <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto w-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              <div className={`p-6 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm`}>
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
                    <label className="text-xs font-semibold text-slate-400 block mb-1">Setor / Departamento</label>
                    <input
                      type="text"
                      placeholder="Ex: Financeiro, TI, Diretoria"
                      value={novoSetor}
                      onChange={(e) => setNovoSetor(e.target.value)}
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
                        setNovoSetor('');
                      }}
                      className="w-full py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition mt-2"
                    >
                      Cancelar Edição
                    </button>
                  )}
                </form>
              </div>

              <div className={`p-6 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-sm lg:col-span-2`}>
                <h3 className="text-base font-bold mb-6">Usuários e Credenciais do Painel</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {usuariosAutorizados.map((usr, index) => (
                    <div key={index} className={`p-4 rounded-xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} flex flex-col justify-between space-y-3`}>
                      <div className="space-y-1">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate pr-2" title={usr.name}>{usr.name}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${usr.role === 'admin' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-slate-100 text-slate-800 dark:bg-slate-850 dark:text-slate-350'}`}>
                            {usr.role === 'admin' ? 'Admin' : 'Visualizador'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{usr.email}</p>
                        <div className="flex flex-col gap-y-1 pt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <div>Setor: <strong className="text-slate-700 dark:text-slate-200 font-bold">{usr.setor || (usr.email === 'lucivaldo586@gmail.com' ? 'Diretoria' : 'Não Informado')}</strong></div>
                          <div>Senha: <code className="bg-slate-200/50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">{usr.password || '123456'}</code></div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/60">
                        <button
                          onClick={() => iniciarEdicao(usr)}
                          className="px-3 py-1.5 bg-indigo-600/15 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/20 rounded-xl text-[10px] font-bold transition duration-300"
                        >
                          Editar
                        </button>
                        {usr.email !== 'lucivaldo586@gmail.com' && (
                          <button
                            onClick={() => removerUsuario(usr.email)}
                            className="px-3 py-1.5 bg-rose-600/15 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 rounded-xl text-[10px] font-bold transition duration-300"
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

      {/* Modal de Alertas Customizado */}
      {alertModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn hide-in-pdf">
          <div className={`w-full max-w-sm p-6 rounded-2xl border ${darkMode ? 'custom-card-dark' : 'custom-card-light'} shadow-2xl shadow-indigo-500/10 transition-all duration-300`}>
            <div className="flex items-center gap-3 mb-4">
              {alertModal.type === 'success' && <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600"><ShieldCheck size={20} /></div>}
              {alertModal.type === 'error' && <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center text-rose-600"><AlertCircle size={20} /></div>}
              {alertModal.type === 'warning' && <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-amber-600"><AlertTriangle size={20} /></div>}
              {alertModal.type === 'info' && <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400"><AlertCircle size={20} /></div>}
              {alertModal.type === 'confirm' && <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400"><AlertCircle size={20} /></div>}
              <h3 className="text-sm font-extrabold">{alertModal.title}</h3>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-300 mb-6 leading-relaxed whitespace-pre-wrap">{alertModal.message}</p>

            <div className="flex justify-end gap-2 text-xs font-bold">
              {alertModal.type === 'confirm' ? (
                <>
                  <button
                    onClick={() => setAlertModal(prev => ({ ...prev, show: false }))}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (alertModal.onConfirm) alertModal.onConfirm();
                      setAlertModal(prev => ({ ...prev, show: false }));
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow transition"
                  >
                    Confirmar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setAlertModal(prev => ({ ...prev, show: false }))}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow transition"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
