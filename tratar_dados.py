import pandas as pd
import numpy as np
import json
import os
import re

def tratar_relatorio_afi(caminho_entrada, caminho_saida=None):
    """
    Trata o arquivo orçamentário bruto (.xls, .xlsx ou .csv/txt exportado),
    limpando metadados, desempilhando linhas em pares e formatando valores.
    """
    print("🔄 Iniciando o processamento do relatório...")
    
    # 1. Carregar o arquivo bruto
    ext = os.path.splitext(caminho_entrada)[1].lower()
    try:
        if ext in ['.xls', '.xlsx']:
            df = pd.read_excel(caminho_entrada, header=None)
        else:
            # Caso o usuário envie CSV/TXT delimitado
            df = pd.read_csv(caminho_entrada, header=None, sep=None, engine='python')
    except Exception as e:
        print(f"❌ Erro ao ler o arquivo: {e}")
        raise e
        
    # 2. Limpar metadados e linhas de cabeçalhos
    termos_sujeira = 'GOVERNO|Unidade|Relação|Página|Gestão :|Dados Acumulados'
    df_clean = df[~df[0].astype(str).str.contains(termos_sujeira, na=False)].reset_index(drop=True)
    
    # 3. Localizar cabeçalho e dados reais
    inicio_dados = 0
    encontrou = False
    for idx, row in df_clean.iterrows():
        if "Número NE" in str(row[0]) or "Data Emis" in str(row[0]):
            inicio_dados = idx + 2
            encontrou = True
            break
            
    if not encontrou:
        df_dados = df_clean.copy()
    else:
        df_dados = df_clean.iloc[inicio_dados:].reset_index(drop=True)
    
    # Garante estrutura em pares
    if len(df_dados) % 2 != 0:
        df_dados = df_dados.iloc[:-1]
        
    pares_raw = df_dados.iloc[0::2].reset_index(drop=True)
    impares_raw = df_dados.iloc[1::2].reset_index(drop=True)
    
    def obter_coluna_segura(df_origem, col_idx, default_val=""):
        if col_idx < len(df_origem.columns):
            return df_origem[col_idx]
        return pd.Series([default_val] * len(df_origem))

    df_final = pd.DataFrame({
        "Num_NE": obter_coluna_segura(pares_raw, 0),
        "Credor": obter_coluna_segura(pares_raw, 1),
        "Processo": obter_coluna_segura(pares_raw, 8),
        "Data_Emis": obter_coluna_segura(impares_raw, 0),
        "UO": obter_coluna_segura(impares_raw, 1),
        "PT": obter_coluna_segura(impares_raw, 2),
        "Fonte": obter_coluna_segura(impares_raw, 4),
        "Natureza": obter_coluna_segura(impares_raw, 6),
        "Emp_Mes": obter_coluna_segura(impares_raw, 9, 0),
        "Emp_Acum": obter_coluna_segura(impares_raw, 11, 0),
        "Liq_Mes": obter_coluna_segura(impares_raw, 14, 0),
        "Liq_Acum": obter_coluna_segura(impares_raw, 17, 0),
        "A_Liquidar": obter_coluna_segura(impares_raw, 21, 0),
        "Pago_Mes": obter_coluna_segura(impares_raw, 24, 0),
        "Pago_Acum": obter_coluna_segura(impares_raw, 26, 0),
        "A_Pagar": obter_coluna_segura(impares_raw, 29, 0)
    })
    
    # Limpeza e Padronização
    df_final["Processo"] = df_final["Processo"].fillna("").astype(str).str.strip()
    df_final["Num_NE"] = df_final["Num_NE"].fillna("").astype(str).str.strip()
    df_final["Credor"] = df_final["Credor"].fillna("Sem Credor").astype(str).str.strip()
    
    # Tratamento de Ano_Processo
    def extrair_ano(processo):
        processo_upper = str(processo).upper()
        if "FOLHA DE PAGAMENTO" in processo_upper or "FOLHA" in processo_upper:
            return "2026"
        match = re.search(r'\b(20\d{2}|19\d{2})\b', processo)
        if match:
            return match.group(0)
        return "Sem Ano"

    df_final['Ano_Processo'] = df_final['Processo'].apply(extrair_ano)
    
    # Limpeza de valores numéricos
    colunas_valores = [
        "Emp_Mes", "Emp_Acum", "Liq_Mes", "Liq_Acum", 
        "A_Liquidar", "Pago_Mes", "Pago_Acum", "A_Pagar"
    ]
    
    for col in colunas_valores:
        if df_final[col].dtype == object:
            # Substitui separador de milhar (.) e substitui a vírgula decimal (,)
            df_final[col] = (df_final[col]
                             .astype(str)
                             .str.replace(r'[R\$\s]', '', regex=True)
                             .str.replace('.', '', regex=False)
                             .str.replace(',', '.', regex=False))
        df_final[col] = pd.to_numeric(df_final[col], errors='coerce').fillna(0.0)
        
    print("✅ Processamento de dados concluído com sucesso!")
    
    if caminho_saida:
        try:
            df_final.to_excel(caminho_saida, index=False)
        except Exception as e:
            print(f"❌ Erro ao salvar arquivo: {e}")
            
    return df_final

def converter_para_json(df):
    df_limpo = df.replace({np.nan: None})
    return df_limpo.to_dict(orientation='records')
