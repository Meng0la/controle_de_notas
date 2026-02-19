
<h1 align="center">📄 Extração Inteligente de Notas Fiscais</h1>
<h3 align="center">NF-e • NFS-e • Automação • Parsing Heurístico • IA Opcional</h3>

<p align="center">
  <img src ="https://media1.tenor.com/m/n2n0DGny2q0AAAAC/tec.gif" width="600" />
</p>

---

## 🚀 Visão Geral

Sistema client-side para extração automática de dados estruturados a partir de documentos fiscais em PDF ou texto bruto.

Transforma notas desestruturadas em dados financeiros normalizados prontos para uso em dashboards e análises.

---

## 🎯 O Problema

- Copiar manualmente número da nota  
- Identificar cliente  
- Localizar CNPJ/CPF  
- Encontrar valor total  
- Converter datas manualmente  

Tudo isso consome tempo e gera erros.

---

## 💡 A Solução

<p align="center">
  <img src="https://media.giphy.com/media/3o7TKtnuHOHHUjR38Y/giphy.gif" width="500"/>
</p>

✔ Upload de PDF  
✔ Extração automática de texto  
✔ Identificação do tipo (NF-e / NFS-e)  
✔ Parsing inteligente  
✔ Validação estrutural  
✔ Criação automática de registro  

---

## 🧠 Como Funciona

### 1️⃣ Upload ou Colagem de Texto

- PDF via PDF.js  
- Texto bruto colado manualmente  

---

### 2️⃣ Extração Textual

<p align="center">
  <img src="https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif" width="500"/>
</p>

- Leitura de múltiplas páginas  
- Consolidação textual  
- Normalização de caracteres  

---

### 3️⃣ Parsing Heurístico Avançado

O sistema utiliza:

- Expressões regulares específicas  
- Busca contextual por blocos  
- Remoção de acentos  
- Limpeza de caracteres inválidos  
- Normalização monetária  

Campos extraídos:

- Número da NF  
- Data de emissão  
- Cliente  
- CPF/CNPJ  
- Valor total  
- Descrição  

---

## 🤖 IA Opcional (Webhook)

Modo híbrido:

- Parsing local  
- Envio opcional para backend  
- Fallback automático  
- Score de confiança  

---

## 🔐 Validações Aplicadas

- CPF válido  
- CNPJ válido  
- Valor maior que zero  
- Data não futura  
- Bloqueio de duplicidade  

---

## 📊 Automação em Lote

<p align="center">
  <img src="https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif" width="500"/>
</p>

- Processamento de múltiplos PDFs  
- Criação automática de registros válidos  
- Identificação de pendências  
- Relatório de sucesso/falha  

---

## 🏗 Arquitetura Modular

```
extractor.js      → Parsing heurístico
pdf-upload.js     → Leitura de PDF
app.js            → Orquestração
storage.js        → Persistência
ui.js             → Interface
```

---

## 🛠 Tecnologias

- JavaScript ES6 Modules  
- PDF.js  
- IndexedDB  
- Regex Avançado  
- Normalização Unicode  

---

## 🔮 Próximas Evoluções

- OCR para PDFs escaneados  
- Extração detalhada de itens  
- Machine Learning local  
- Classificação automática de serviços  
- Score avançado de confiabilidade  

---

<p align="center">
  <b>Automatize o que é repetitivo. Estruture o que é caótico.</b>
</p>
