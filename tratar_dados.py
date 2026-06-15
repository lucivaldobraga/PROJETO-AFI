import pandas as pd
import numpy as np
import json
import os

def tratar_relatorio_afi(caminho_entrada, caminho_saida=None):
    """
    Trata o arquivo orçamentário bruto (.xls ou .xlsx), limpando metadados,
    desempilhando as linhas que vêm em pares e formatando as colunas.
    Retorna o DataFrame tratado e opcionalmente salva em formato Excel.
    """
    print("🔄 Iniciando o processamento do relatório...")
    
    # 1. Carregar o arquivo Excel bruto (sem definir cabeçalho ainda)
    try:
        df = pd.read_excel(caminho_entrada, header=None)
    except Exception as e:
        print(f"❌ Erro ao ler o arquivo Excel: {e}")
        raise e
        
    # 2. Limpar metadados e linhas de impressão do sistema
    termos_sujeira = 'GOVERNO|Unidade|Relação|Página|Gestão :|Dados Acumulados'
    df_clean = df[~df[0].astype(str).str.contains(termos_sujeira, na=False)].reset_index(drop=True)
    
    # 3. Localizar onde começam os dados reais
    inicio_dados = 0
    encontrou = False
    for idx, row in df_clean.iterrows():
        if "Número NE" in str(row[0]):
            inicio_dados = idx + 2  # Pula a linha "Número NE" e a linha "Data Emis. NE"
            encontrou = True
            break
            
    if not encontrou:
        print("⚠️ Cabeçalho 'Número NE' não encontrado. Assumindo início a partir da linha 0.")
        df_dados = df_clean.copy()
    else:
        df_dados = df_clean.iloc[inicio_dados:].reset_index(drop=True)
    
    if len(df_dados) % 2 != 0:
        df_dados = df_dados.iloc[:-1]
        
    # 4. Separar os blocos de linhas pares (NE, Credor, Processo) e ímpares (Datas e Valores)
    pares_raw = df_dados.iloc[0::2].reset_index(drop=True)
    impares_raw = df_dados.iloc[1::2].reset_index(drop=True)
    
    # 5. Mapeamento das colunas baseado nas posições originais da planilha
    def obter_coluna_segura(df_origem, col_idx, default_val=""):
        if col_idx in df_origem.columns:
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
    
    # 6. Limpeza de strings e segurança contra valores nulos
    df_final["Processo"] = df_final["Processo"].fillna("").astype(str).str.strip()
    df_final["Num_NE"] = df_final["Num_NE"].fillna("").astype(str).str.strip()
    df_final["Credor"] = df_final["Credor"].fillna("Sem Credor").astype(str).str.strip()
    df_final["Data_Emis"] = df_final["Data_Emis"].fillna("").astype(str).str.strip()
    df_final["UO"] = df_final["UO"].fillna("").astype(str).str.strip()
    df_final["PT"] = df_final["PT"].fillna("").astype(str).str.strip()
    df_final["Fonte"] = df_final["Fonte"].fillna("").astype(str).str.strip()
    df_final["Natureza"] = df_final["Natureza"].fillna("").astype(str).str.strip()
    
    # 7. Regra de Negócio: Criar a coluna 'Ano_Processo' tratando Folha de Pagamento
    def extrair_ano(processo):
        processo_upper = str(processo).upper()
        if "FOLHA DE PAGAMENTO" in processo_upper or "FOLHA" in processo_upper:
            return "2026"
        if len(processo) >= 4:
            ultimos_4 = processo[-4:]
            if ultimos_4.isdigit():
                return ultimos_4
        import re
        match = re.search(r'\b(20\d{2}|19\d{2})\b', processo)
        if match:
            return match.group(0)
        return "Sem Ano"

    df_final['Ano_Processo'] = df_final['Processo'].apply(extrair_ano)
    
    # 8. Tratamento de colunas numéricas
    colunas_valores = [
        "Emp_Mes", "Emp_Acum", "Liq_Mes", "Liq_Acum", 
        "A_Liquidar", "Pago_Mes", "Pago_Acum", "A_Pagar"
    ]
    
    for col in colunas_valores:
        if df_final[col].dtype == object:
            df_final[col] = (df_final[col]
                             .astype(str)
                             .str.replace(r'[R\$\s\.]', '', regex=True)
                             .str.replace(',', '.', regex=False))
        df_final[col] = pd.to_numeric(df_final[col], errors='coerce').fillna(0.0)
        
    print("✅ Processamento de dados concluído com sucesso!")
    
    if caminho_saida:
        try:
            df_final.to_excel(caminho_saida, index=False)
            print(f"💾 Arquivo tratado salvo em: {caminho_saida}")
        except Exception as e:
            print(f"❌ Erro ao salvar arquivo Excel de saída: {e}")
            
    return df_final

def converter_para_json(df):
    df_limpo = df.replace({np.nan: None})
    records = df_limpo.to_dict(orientation='records')
    return records
