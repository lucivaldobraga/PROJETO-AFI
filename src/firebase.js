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
  orderBy
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';

// As credenciais serão lidas do ambiente (.env), com fallback seguro
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy-key-for-local-preview",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "afi-orcamento.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "afi-orcamento",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "afi-orcamento.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcd1234ef"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Serviços estruturados para conexão direta com o Firebase
export const firebaseService = {
  // Autenticação
  login: (email, password) => signInWithEmailAndPassword(auth, email, password),
  logout: () => signOut(auth),
  onAuthChange: (callback) => onAuthStateChanged(auth, callback),

  // Firestore: Buscar todos os orçamentos reais armazenados
  obterOrcamentos: async () => {
    try {
      const q = query(collection(db, 'orcamentos'), orderBy('Ano_Processo', 'desc'));
      const querySnapshot = await getDocs(q);
      const records = [];
      querySnapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() });
      });
      return records;
    } catch (error) {
      console.warn("Utilizando fallback local. Configure o Firebase no seu painel para sincronização total:", error);
      return null;
    }
  },

  // Firestore: Buscar histórico de arquivos enviados
  obterArquivos: async () => {
    try {
      const q = query(collection(db, 'arquivos'), orderBy('processado_em', 'desc'));
      const querySnapshot = await getDocs(q);
      const records = [];
      querySnapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() });
      });
      return records;
    } catch (error) {
      return null;
    }
  },

  // Storage: Upload de novo arquivo bruto
  fazerUploadArquivo: async (file) => {
    const storageRef = ref(storage, `bruto/${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    // Salva registro inicial do arquivo no Firestore
    const docRef = await addDoc(collection(db, 'arquivos'), {
      nome_original: file.name,
      caminho_bruto: `bruto/${file.name}`,
      status: 'processando',
      processado_em: serverTimestamp()
    });

    return { docId: docRef.id, downloadURL };
  }
};

export default app;
