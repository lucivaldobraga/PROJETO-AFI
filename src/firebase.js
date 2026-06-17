import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
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
  writeBatch,
  onSnapshot,
  getDoc,
  setDoc
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
  obterUsuarios: async () => {
    const stored = localStorage.getItem('afi_usuarios');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    const defaultList = [
      { uid: 'default-admin', email: 'lucivaldo586@gmail.com', name: 'Lucivaldo Braga', role: 'admin', password: 'admin123', setor: 'Diretoria' }
    ];
    localStorage.setItem('afi_usuarios', JSON.stringify(defaultList));
    return defaultList;
  },
  criarUsuario: async (email, password, perfil) => {
    const usuarios = await mockService.obterUsuarios();
    if (usuarios.some(u => u.email === email)) {
      throw new Error("E-mail já cadastrado localmente!");
    }
    const novoUsuario = {
      uid: 'local-' + Date.now(),
      email,
      password,
      ...perfil
    };
    usuarios.push(novoUsuario);
    localStorage.setItem('afi_usuarios', JSON.stringify(usuarios));
    return novoUsuario;
  },
  removerUsuario: async (uid) => {
    const usuarios = await mockService.obterUsuarios();
    const filtrados = usuarios.filter(u => u.uid !== uid);
    localStorage.setItem('afi_usuarios', JSON.stringify(filtrados));
    return true;
  },
  login: async (email, password) => {
    const usuarios = await mockService.obterUsuarios();
    const usuarioExiste = usuarios.find(u => u.email === email && u.password === password);
    if (usuarioExiste) {
      localStorage.setItem('afi_user', JSON.stringify(usuarioExiste));
      if (authChangeCallback) authChangeCallback(usuarioExiste);
      return usuarioExiste;
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
    
    // Converte orcamentos atuais para um Map baseado em Num_NE para fácil substituição/mesclagem
    const orcamentoMap = new Map();
    const semNe = [];
    
    for (const o of orcamentos) {
      const ne = String(o.Num_NE || "").trim();
      if (ne) {
        orcamentoMap.set(ne, o);
      } else {
        semNe.push(o);
      }
    }
    
    for (const r of registros) {
      const ne = String(r.Num_NE || "").trim();
      if (ne) {
        const existing = orcamentoMap.get(ne) || {};
        orcamentoMap.set(ne, {
          ...existing,
          ...r,
          arquivo_origem: nomeArquivo
        });
      } else {
        semNe.push({
          ...r,
          arquivo_origem: nomeArquivo
        });
      }
    }
    
    const novosOrcamentos = [...orcamentoMap.values(), ...semNe];
    
    // Evitar duplicar o arquivo de log se o mesmo arquivo for re-enviado
    const arquivosFiltrados = arquivos.filter(a => a.nome_original !== nomeArquivo);
    const novosArquivos = [{
      nome_original: nomeArquivo,
      processado_em: new Date().toLocaleString('pt-BR'),
      total_linhas: registros.length,
      status: 'sucesso'
    }, ...arquivosFiltrados];
    
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
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const profileDoc = await getDoc(doc(db, 'usuarios', userCredential.user.uid));
      if (profileDoc.exists()) {
        return {
          uid: userCredential.user.uid,
          email: userCredential.user.email.toLowerCase(),
          ...profileDoc.data()
        };
      }
      const fallbackProfile = {
        uid: userCredential.user.uid,
        email: userCredential.user.email.toLowerCase(),
        name: userCredential.user.email.split('@')[0],
        role: userCredential.user.email.toLowerCase() === 'lucivaldo586@gmail.com' ? 'admin' : 'viewer',
        setor: 'Geral'
      };
      if (userCredential.user.email.toLowerCase() === 'lucivaldo586@gmail.com') {
        await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
          name: 'Lucivaldo Braga',
          email: userCredential.user.email.toLowerCase(),
          role: 'admin',
          setor: 'Diretoria'
        });
        fallbackProfile.name = 'Lucivaldo Braga';
        fallbackProfile.role = 'admin';
        fallbackProfile.setor = 'Diretoria';
      }
      return fallbackProfile;
    } catch (error) {
      if (normalizedEmail === 'lucivaldo586@gmail.com' && password === 'admin123') {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
          const fallbackProfile = {
            uid: userCredential.user.uid,
            email: userCredential.user.email.toLowerCase(),
            name: 'Lucivaldo Braga',
            role: 'admin',
            setor: 'Diretoria'
          };
          await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
            name: 'Lucivaldo Braga',
            email: userCredential.user.email.toLowerCase(),
            role: 'admin',
            setor: 'Diretoria'
          });
          return fallbackProfile;
        } catch (createError) {
          console.error("Erro ao auto-provisionar administrador:", createError);
        }
      }
      throw error;
    }
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
    return onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const profileDoc = await getDoc(doc(db, 'usuarios', currentUser.uid));
          if (profileDoc.exists()) {
            callback({
              uid: currentUser.uid,
              email: currentUser.email.toLowerCase(),
              ...profileDoc.data()
            });
          } else {
            const userEmail = currentUser.email.toLowerCase();
            if (userEmail === 'lucivaldo586@gmail.com') {
              await setDoc(doc(db, 'usuarios', currentUser.uid), {
                name: 'Lucivaldo Braga',
                email: userEmail,
                role: 'admin',
                setor: 'Diretoria'
              });
              callback({
                uid: currentUser.uid,
                email: userEmail,
                name: 'Lucivaldo Braga',
                role: 'admin',
                setor: 'Diretoria'
              });
            } else {
              callback({
                uid: currentUser.uid,
                email: userEmail,
                name: userEmail.split('@')[0],
                role: 'viewer',
                setor: 'Geral'
              });
            }
          }
        } catch (e) {
          console.warn("Erro ao ler dados adicionais do perfil:", e);
          const userEmail = currentUser.email.toLowerCase();
          callback({
            uid: currentUser.uid,
            email: userEmail,
            name: userEmail === 'lucivaldo586@gmail.com' ? 'Lucivaldo Braga' : userEmail.split('@')[0],
            role: userEmail === 'lucivaldo586@gmail.com' ? 'admin' : 'viewer',
            setor: userEmail === 'lucivaldo586@gmail.com' ? 'Diretoria' : 'Geral'
          });
        }
      } else {
        callback(null);
      }
    });
  },

  obterUsuarios: async () => {
    if (firebaseService.isLocalSandbox()) {
      return mockService.obterUsuarios();
    }
    try {
      const qSnapshot = await getDocs(collection(db, 'usuarios'));
      const records = [];
      qSnapshot.forEach((doc) => {
        records.push({ uid: doc.id, ...doc.data() });
      });
      return records;
    } catch (e) {
      console.error("Erro ao obter usuários do Firestore:", e);
      return mockService.obterUsuarios();
    }
  },

  criarUsuario: async (email, password, perfil) => {
    if (firebaseService.isLocalSandbox()) {
      return mockService.criarUsuario(email, password, perfil);
    }
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const secondaryAppName = 'SecondaryAuth' + Date.now();
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, password);
      const uid = userCredential.user.uid;
      
      await signOut(secondaryAuth);
      
      await setDoc(doc(db, 'usuarios', uid), {
        email: normalizedEmail,
        name: perfil.name,
        role: perfil.role,
        setor: perfil.setor
      });
      
      return { uid, email: normalizedEmail, ...perfil };
    } catch (e) {
      console.error("Erro ao criar usuário no Firebase Auth:", e);
      throw e;
    }
  },

  removerUsuario: async (uid) => {
    if (firebaseService.isLocalSandbox()) {
      return mockService.removerUsuario(uid);
    }
    try {
      await deleteDoc(doc(db, 'usuarios', uid));
      return true;
    } catch (e) {
      console.error("Erro ao remover usuário do Firestore:", e);
      throw e;
    }
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
      console.error("Erro ao deletar arquivo no Firestore:", error);
      throw new Error("Não foi possível excluir o arquivo no Firebase. Verifique sua conexão e permissões do Firestore. Detalhes: " + error.message);
    }
  },

  adicionarRegistros: async (registros, nomeArquivo) => {
    if (firebaseService.isLocalSandbox()) {
      await mockService.adicionarRegistrosLocais(registros, nomeArquivo);
      return;
    }
    try {
      // Registrar log do arquivo
      const docArqRef = doc(collection(db, 'arquivos'));
      const batchArq = writeBatch(db);
      batchArq.set(docArqRef, {
        nome_original: nomeArquivo,
        status: 'sucesso',
        total_linhas: registros.length,
        processado_em: new Date().toLocaleString('pt-BR')
      });
      await batchArq.commit();
      
      // Salvar os registros no Firestore em lotes de no máximo 400 para respeitar o limite de 500 escritas do Firestore
      const chunk = 400;
      for (let i = 0; i < registros.length; i += chunk) {
        const lote = registros.slice(i, i + chunk);
        const batch = writeBatch(db);
        for (const r of lote) {
          const numNe = String(r.Num_NE || "").trim();
          const docId = numNe.replace(/[\/\s#\?]/g, '_');
          let docOrcRef;
          if (!docId) {
            docOrcRef = doc(collection(db, 'orcamentos'));
          } else {
            docOrcRef = doc(db, 'orcamentos', docId);
          }
          batch.set(docOrcRef, {
            ...r,
            arquivo_origem: nomeArquivo
          }, { merge: true });
        }
        await batch.commit();
      }
    } catch (e) {
      console.error("Erro ao salvar dados no Firestore:", e);
      throw new Error("Falha ao salvar os dados online no Firebase. Verifique se o Cloud Firestore está ativo e as regras de segurança aplicadas no console do Firebase. Detalhes: " + e.message);
    }
  },

  assinarOrcamentos: (onUpdate, onError) => {
    if (firebaseService.isLocalSandbox()) {
      onUpdate(JSON.parse(localStorage.getItem('afi_orcamentos') || '[]'));
      return () => {};
    }
    const q = query(collection(db, 'orcamentos'), orderBy('Ano_Processo', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const records = [];
      snapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() });
      });
      onUpdate(records);
    }, (error) => {
      console.warn("Erro ao ouvir orçamentos:", error);
      if (onError) onError(error);
    });
  },

  assinarArquivos: (onUpdate, onError) => {
    if (firebaseService.isLocalSandbox()) {
      onUpdate(JSON.parse(localStorage.getItem('afi_arquivos') || '[]'));
      return () => {};
    }
    const q = query(collection(db, 'arquivos'), orderBy('processado_em', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const records = [];
      snapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() });
      });
      onUpdate(records);
    }, (error) => {
      console.warn("Erro ao ouvir arquivos:", error);
      if (onError) onError(error);
    });
  },

  atualizarPerfil: async (uid, perfil) => {
    if (firebaseService.isLocalSandbox()) {
      return;
    }
    try {
      await setDoc(doc(db, 'usuarios', uid), perfil, { merge: true });
    } catch (e) {
      console.error("Erro ao atualizar perfil no Firestore:", e);
      throw e;
    }
  }
};
