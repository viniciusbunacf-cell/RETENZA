# Prospecção: provedores-alvo para o piloto

`provedores-alvo-anatel-2026-09.xlsx` lista os provedores de internet com 1.000 a 30.000 acessos de banda larga fixa, segundo os dados abertos da Anatel (mês de referência setembro de 2026), com uma nota de prioridade para o piloto do RETENZA.

- **Fonte:** Anatel, Dados Abertos, [Acessos de Banda Larga Fixa](https://www.anatel.gov.br/dadosabertos/paineis_de_dados/acessos/acessos_banda_larga_fixa.zip). Números declarados pelas próprias empresas; sem telefone ou e-mail.
- **Filtros:** 1.000 a 30.000 acessos por CNPJ; fora as prestadoras de grande porte e as empresas de grupos econômicos com mais de 30.000 acessos somados.
- **Nota (0 a 100):** tamanho da base, variação de acessos em 6 meses (perda líquida pesa mais), participação de fibra e de clientes pessoa física. Os parâmetros ficam na aba Critérios da planilha.

## Atualizar com um mês mais recente

Os scripts ficam em `scripts/prospeccao/`. O arquivo da Anatel tem cerca de 1 GB; `aggregate.py` lê só o CSV do ano pedido, por partes, sem baixar o arquivo inteiro.

1. Ajuste em `aggregate.py` os meses `MAIN` (referência) e `PREV` (comparação, 6 meses antes) e o nome do CSV do ano.
2. Gere o agregado:

```bash
python3 -I scripts/prospeccao/aggregate.py scripts/prospeccao https://www.anatel.gov.br/dadosabertos/paineis_de_dados/acessos/acessos_banda_larga_fixa.zip Acessos_Banda_Larga_Fixa_2026.csv /tmp/agregado.json
```

3. Monte a planilha:

```bash
python3 -I scripts/prospeccao/planilha.py /tmp/agregado.json docs/prospeccao/provedores-alvo-anatel-AAAA-MM.xlsx
```

A planilha sai com fórmulas sem valores calculados; abra no Excel ou no LibreOffice, ou recalcule antes de compartilhar.
