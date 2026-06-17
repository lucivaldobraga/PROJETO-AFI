import functions_framework
from firebase_admin import credentials, firestore, initialize_app, storage
import pandas as pd
import tempfile
import os
from tratar_dados import tratar_relatorio_afi, converter_para_json

# Inicializa o Firebase Admin SDK
initialize_app()
db = firestore.client()

@functions_framework.cloud_event
def processar_upload_afi(cloud_event):
    """
    Função de segundo plano disparada quando um novo arquivo é enviado ao Storage.
    Detecta o upload de arquivos .xls ou .xlsx brutos na pasta 'bruto/'.
    Trata os dados com Pandas, salva o resultado tratado como .xlsx na pasta 'tratado/'
    e armazena os registros no Firestore para gerar os gráficos.
    """
    data = cloud_event.data
    bucket_name = data["bucket"]
    file_name = data["name"]
    
    # Executa apenas se for um arquivo bruto na pasta correspondente
    if not (file_name.startswith("bruto/") and (file_name.endswith(".xls") or file_name.endswith(".xlsx"))):
        print(f"File {file_name} ignored. Not in 'bruto/' folder or not an Excel file.")
        return

    print(f"📥 Novo arquivo detectado para processamento: {file_name} no bucket {bucket_name}")
    
    bucket = storage.bucket(bucket_name)
    blob = bucket.blob(file_name)
    
    # Criar arquivos temporários para processamento
    _, temp_input_path = tempfile.mkstemp(suffix=os.path.splitext(file_name)[1])
    _, temp_output_path = tempfile.mkstemp(suffix=".xlsx")
    
    try:
        # Download do arquivo bruto do Storage
        blob.download_to_filename(temp_input_path)
        print("💾 Download do arquivo bruto concluído.")
        
        # Processa e limpa os dados usando Pandas
        df_tratado = tratar_relatorio_afi(temp_input_path, temp_output_path)
        
        # Upload do arquivo tratado final de volta ao Storage
        nome_saida = file_name.replace("bruto/", "tratado/").replace(".xls", ".xlsx")
        blob_saida = bucket.blob(nome_saida)
        blob_saida.upload_from_filename(temp_output_path)
        print(f"📤 Arquivo tratado enviado para o Storage: {nome_saida}")
        
        # Converter para JSON para persistir no Firestore
        registros = converter_para_json(df_tratado)
        
        # Salva o log do arquivo e os registros no Firestore
        batch = db.batch()
        
        # Documento de metadados do upload do arquivo
        doc_arquivo_ref = db.collection("arquivos").document(os.path.basename(file_name))
        doc_arquivo_ref.set({
            "nome_original": os.path.basename(file_name),
            "caminho_bruto": file_name,
            "caminho_tratado": nome_saida,
            "total_linhas": len(df_tratado),
            "processado_em": firestore.SERVER_TIMESTAMP,
            "status": "sucesso"
        })
        
        # Salva cada linha de orçamento no Firestore vinculado a este arquivo
        # Limita para evitar estouro de limite de gravação em lote se a planilha for gigantesca (em lotes de 500)
        import re
        tamanho_lote = 400
        for i in range(0, len(registros), tamanho_lote):
            lote_atual = registros[i:i + tamanho_lote]
            batch_firestore = db.batch()
            for r in lote_atual:
                num_ne = str(r.get("Num_NE", "")).strip()
                doc_id = re.sub(r'[\/\s#\?]', '_', num_ne)
                if not doc_id:
                    doc_ref = db.collection("orcamentos").document()
                else:
                    doc_ref = db.collection("orcamentos").document(doc_id)
                r["arquivo_origem"] = os.path.basename(file_name)
                r["criado_em"] = firestore.SERVER_TIMESTAMP
                batch_firestore.set(doc_ref, r, merge=True)
            batch_firestore.commit()
            
        print(f"🔥 {len(registros)} registros salvos com sucesso no Firestore!")
        
    except Exception as e:
        print(f"❌ Erro durante o processamento da Cloud Function: {e}")
        # Atualiza status do arquivo como falha
        try:
            db.collection("arquivos").document(os.path.basename(file_name)).set({
                "nome_original": os.path.basename(file_name),
                "processado_em": firestore.SERVER_TIMESTAMP,
                "status": "erro",
                "erro_mensagem": str(e)
            })
        except Exception as fe:
            print(f"Erro ao salvar status de erro no Firestore: {fe}")
            
    finally:
        # Remover os arquivos temporários criados
        if os.path.exists(temp_input_path):
            os.remove(temp_input_path)
        if os.path.exists(temp_output_path):
            os.remove(temp_output_path)
        print("🗑️ Limpeza de arquivos temporários concluída.")
