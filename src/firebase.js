import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where,
  serverTimestamp,
  orderBy,
  deleteDoc,
  doc,
  writeBatch
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy-key-for-local-preview",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "afi-orcamento.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "afi-orcamento",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "afi-orcamento.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcd1234ef"
};

const isDummyConfig = firebaseConfig.apiKey === "dummy-key-for-local-preview";

// Inicializa o Firebase apenas se a chave não for a dummy para evitar erros de rede/CORS inúteis
let app, auth, db;
if (!isDummyConfig) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.warn("Erro ao inicializar o Firebase. Operando em modo Sandbox local:", e);
  }
}

// Ouvinte do mock auth
let authChangeCallback = null;

const mockService = {
  login: async (email, password) => {
    if (email === 'lucivaldo586@gmail.com' && password === 'admin123') {
      const mockUser = { email, name: 'Lucivaldo Braga', role: 'admin' };
      localStorage.setItem('afi_user', JSON.stringify(mockUser));
      if (authChangeCallback) authChangeCallback(mockUser);
      return mockUser;
    }
    throw new Error("Credenciais inválidas no modo Sandbox.");
  },
  logout: async () => {
    localStorage.removeItem('afi_user');
    if (authChangeCallback) authChangeCallback(null);
  },
  onAuthChange: (callback) => {
    authChangeCallback = callback;
    const stored = localStorage.getItem('afi_user');
    if (stored) {
      try {
        callback(JSON.parse(stored));
      } catch (e) {
        callback(null);
      }
    } else {
      callback(null);
    }
    return () => { authChangeCallback = null; };
  },
  obterOrcamentos: async () => {
    const stored = localStorage.getItem('afi_orcamentos');
    return stored ? JSON.parse(stored) : [];
  },
  obterArquivos: async () => {
    const stored = localStorage.getItem('afi_arquivos');
    return stored ? JSON.parse(stored) : [];
  },
  removerArquivo: async (nomeOriginal) => {
    const orcamentos = JSON.parse(localStorage.getItem('afi_orcamentos') || '[]');
    const arquivos = JSON.parse(localStorage.getItem('afi_arquivos') || '[]');
    
    const novosOrcamentos = orcamentos.filter(o => o.arquivo_origem !== nomeOriginal);
    const novosArquivos = arquivos.filter(a => a.nome_original !== nomeOriginal);
    
    localStorage.setItem('afi_orcamentos', JSON.stringify(novosOrcamentos));
    localStorage.setItem('afi_arquivos', JSON.stringify(novosArquivos));
    return true;
  },
  adicionarRegistrosLocais: async (registros, nomeArquivo) => {
    const orcamentos = JSON.parse(localStorage.getItem('afi_orcamentos') || '[]');
    const arquivos = JSON.parse(localStorage.getItem('afi_arquivos') || '[]');
    
    const novosOrcamentos = [...registros.map(r => ({ ...r, arquivo_origem: nomeArquivo })), ...orcamentos];
    const novosArquivos = [{
      nome_original: nomeArquivo,
      processado_em: new Date().toLocaleString('pt-BR'),
      total_linhas: registros.length,
      status: 'sucesso'
    }, ...arquivos];
    
    localStorage.setItem('afi_orcamentos', JSON.stringify(novosOrcamentos));
    localStorage.setItem('afi_arquivos', JSON.stringify(novosArquivos));
  }
};

export const firebaseService = {
  isLocalSandbox: () => isDummyConfig || !db,

  login: async (email, password) => {
    if (firebaseService.isLocalSandbox()) {
      return mockService.login(email, password);
    }
    return signInWithEmailAndPassword(auth, email, password);
  },

  logout: async () => {
    if (firebaseService.isLocalSandbox()) {
      return mockService.logout();
    }
    return signOut(auth);
  },

  onAuthChange: (callback) => {
    if (firebaseService.isLocalSandbox()) {
      return mockService.onAuthChange(callback);
    }
    return onAuthStateChanged(auth, callback);
  },

  obterOrcamentos: async () => {
    if (firebaseService.isLocalSandbox()) {
      return mockService.obterOrcamentos();
    }
    try {
      const q = query(collection(db, 'orcamentos'), orderBy('Ano_Processo', 'desc'));
      const querySnapshot = await getDocs(q);
      const records = [];
      querySnapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() });
      });
      return records;
    } catch (error) {
      console.warn("Erro ao ler do Firestore, usando fallback local:", error);
      return mockService.obterOrcamentos();
    }
  },

  obterArquivos: async () => {
    if (firebaseService.isLocalSandbox()) {
      return mockService.obterArquivos();
    }
    try {
      const q = query(collection(db, 'arquivos'), orderBy('processado_em', 'desc'));
      const querySnapshot = await getDocs(q);
      const records = [];
      querySnapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() });
      });
      return records;
    } catch (error) {
      return mockService.obterArquivos();
    }
  },

  removerArquivo: async (nomeOriginal) => {
    if (firebaseService.isLocalSandbox()) {
      return mockService.removerArquivo(nomeOriginal);
    }
    try {
      const qArq = query(collection(db, 'arquivos'), where('nome_original', '==', nomeOriginal));
      const snapArq = await getDocs(qArq);
      for (const docSnap of snapArq.docs) {
        await deleteDoc(doc(db, 'arquivos', docSnap.id));
      }

      const qOrc = query(collection(db, 'orcamentos'), where('arquivo_origem', '==', nomeOriginal));
      const snapOrc = await getDocs(qOrc);
      for (const docSnap of snapOrc.docs) {
        await deleteDoc(doc(db, 'orcamentos', docSnap.id));
      }
      return true;
    } catch (error) {
      console.error("Erro ao deletar arquivo, usando fallback local:", error);
      return mockService.removerArquivo(nomeOriginal);
    }
  },

  adicionarRegistros: async (registros, nomeArquivo) => {
    if (firebaseService.isLocalSandbox()) {
      await mockService.adicionarRegistrosLocais(registros, nomeArquivo);
      return;
    }
    try {
      const batch = writeBatch(db);
      
      const docArqRef = doc(collection(db, 'arquivos'));
      batch.set(docArqRef, {
        nome_original: nomeArquivo,
        status: 'sucesso',
        total_linhas: registros.length,
        processado_em: new Date().toLocaleString('pt-BR')
      });
      
      for (const r of registros) {
        const docOrcRef = doc(collection(db, 'orcamentos'));
        batch.set(docOrcRef, {
          ...r,
          arquivo_origem: nomeArquivo
        });
      }
      await batch.commit();
    } catch (e) {
      console.error("Erro ao salvar no Firestore, usando fallback local:", e);
      await mockService.adicionarRegistrosLocais(registros, nomeArquivo);
    }
  }
};
