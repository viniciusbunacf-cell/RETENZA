"""Monta a planilha de provedores-alvo a partir do agregado da Anatel.

Uso:
  python3 -I scripts/prospeccao/planilha.py <agregado.json> <saida.xlsx>

O agregado vem de aggregate.py (acessos de banda larga fixa por CNPJ). A nota de
prioridade é calculada por fórmulas na própria planilha, com os parâmetros da
aba Critérios; score.py aplica as mesmas regras só para ordenar as linhas.
"""
import json
import os
import sys
from collections import Counter
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from score import P, pontos  # noqa: E402

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

FONTE_URL = "https://www.anatel.gov.br/dadosabertos/paineis_de_dados/acessos/acessos_banda_larga_fixa.zip"
MESES = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
ETAPAS = ["A contatar", "Mensagem enviada", "Conversa marcada", "Conversa feita", "Piloto proposto", "Parceiro", "Descartado"]
UF_NOME = {"AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas", "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal",
           "ES": "Espírito Santo", "GO": "Goiás", "MA": "Maranhão", "MT": "Mato Grosso", "MS": "Mato Grosso do Sul", "MG": "Minas Gerais",
           "PA": "Pará", "PB": "Paraíba", "PR": "Paraná", "PE": "Pernambuco", "PI": "Piauí", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
           "RS": "Rio Grande do Sul", "RO": "Rondônia", "RR": "Roraima", "SC": "Santa Catarina", "SP": "São Paulo", "SE": "Sergipe", "TO": "Tocantins"}

ARIAL = "Arial"
F_BASE = Font(name=ARIAL, size=10)
F_DADO = Font(name=ARIAL, size=10, color="0000FF")
F_TITULO = Font(name=ARIAL, size=16, bold=True, color="141B26")
F_SUB = Font(name=ARIAL, size=11, bold=True, color="141B26")
F_CAB = Font(name=ARIAL, size=10, bold=True, color="FFFFFF")
F_LINK = Font(name=ARIAL, size=10, color="1B66D6", underline="single")
FILL_CAB = PatternFill("solid", fgColor="141B26")
FILL_PREENCHER = PatternFill("solid", fgColor="FFFF00")
FILL_PARAM = PatternFill("solid", fgColor="FFFF00")
LINHA = Side(style="thin", color="D9DEE6")
BORDA = Border(bottom=LINHA)


def cnpj_fmt(c):
    c = "".join(ch for ch in c if ch.isdigit()).zfill(14)
    return f"{c[:2]}.{c[2:5]}.{c[5:8]}/{c[8:12]}-{c[12:]}"


def cabecalho(ws, row, nomes, larguras):
    for i, (nome, larg) in enumerate(zip(nomes, larguras), 1):
        c = ws.cell(row=row, column=i, value=nome)
        c.font, c.fill = F_CAB, FILL_CAB
        c.alignment = Alignment(vertical="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(i)].width = larg
    ws.row_dimensions[row].height = 32


def main(src, out):
    d = json.load(open(src, encoding="utf-8"))
    mes, mes_ant, ano = d["mes"], d["mes_anterior"], d["ano"]
    ref, ref_ant = f"{MESES[mes]}/{ano}", f"{MESES[mes_ant]}/{ano}"
    grupos = d["grupos"]
    alvo = [e for e in d["empresas"]
            if 1000 <= e["total"] <= 30000 and e["porte"] != "Grande Porte"
            and not (e["grupo"] not in ("OUTROS", "") and grupos.get(e["grupo"], 0) > 30000)]
    for e in alvo:
        e["s"] = pontos(e)
    alvo.sort(key=lambda e: (-e["s"]["nota"], -e["total"]))
    excluidos_grupo = sum(1 for e in d["empresas"] if 1000 <= e["total"] <= 30000 and e not in alvo)

    wb = Workbook()

    # ------------------------------------------------------------------ Critérios
    cr = wb.active
    cr.title = "Critérios"
    crit_rows = [
        ("Tamanho (acessos no mês de referência)", None, None),
        ("Faixa ideal: mínimo", P["ideal_min"], "acessos"),
        ("Faixa ideal: máximo", P["ideal_max"], "acessos"),
        ("Faixa média: mínimo", P["medio_min"], "acessos"),
        ("Pontos na faixa ideal", P["pts_ideal"], "pontos"),
        ("Pontos acima da faixa ideal (até 30.000)", P["pts_grande"], "pontos"),
        ("Pontos na faixa média", P["pts_medio"], "pontos"),
        ("Pontos abaixo da faixa média (a partir de 1.000)", P["pts_pequeno"], "pontos"),
        ("Variação de acessos em 6 meses", None, None),
        ("Variação considerada atípica (para mais ou para menos)", P["atipico"], "%"),
        ("Perda forte: variação até", P["perda_forte"], "%"),
        ("Crescimento leve: variação até", P["cresc_leve"], "%"),
        ("Pontos com perda forte", P["pts_perda_forte"], "pontos"),
        ("Pontos com perda leve (até 0%)", P["pts_perda"], "pontos"),
        ("Pontos com crescimento leve", P["pts_cresc_leve"], "pontos"),
        ("Pontos com crescimento acima do leve", P["pts_cresc"], "pontos"),
        ("Pontos sem dado anterior ou com variação atípica", P["pts_sem"], "pontos"),
        ("Tecnologia (fibra até a casa)", None, None),
        ("Fibra alta: a partir de", P["fibra_alta"], "%"),
        ("Fibra média: a partir de", P["fibra_media"], "%"),
        ("Pontos com fibra alta", P["pts_fibra_alta"], "pontos"),
        ("Pontos com fibra média", P["pts_fibra_media"], "pontos"),
        ("Pontos com fibra baixa", P["pts_fibra_baixa"], "pontos"),
        ("Base residencial (pessoa física)", None, None),
        ("Residencial alta: a partir de", P["res_alta"], "%"),
        ("Pontos com residencial alta", P["pts_res_alta"], "pontos"),
        ("Pontos com residencial abaixo disso", P["pts_res_baixa"], "pontos"),
        ("Prioridade", None, None),
        ("Alta: nota a partir de", P["alta"], "pontos"),
        ("Média: nota a partir de", P["media"], "pontos"),
    ]
    cr["A1"] = "Critérios da nota de prioridade"
    cr["A1"].font = F_TITULO
    cr["A2"] = "Altere os valores amarelos: a nota e a prioridade da aba Provedores são recalculadas. A ordem das linhas e a aba Prioritários não mudam."
    cr["A2"].font = F_BASE
    cr.column_dimensions["A"].width = 58
    cr.column_dimensions["B"].width = 14
    cr.column_dimensions["C"].width = 10
    ref_cell = {}
    keys = ["", "ideal_min", "ideal_max", "medio_min", "pts_ideal", "pts_grande", "pts_medio", "pts_pequeno",
            "", "atipico", "perda_forte", "cresc_leve", "pts_perda_forte", "pts_perda", "pts_cresc_leve", "pts_cresc", "pts_sem",
            "", "fibra_alta", "fibra_media", "pts_fibra_alta", "pts_fibra_media", "pts_fibra_baixa",
            "", "res_alta", "pts_res_alta", "pts_res_baixa", "", "alta", "media"]
    r = 4
    for (rotulo, valor, unidade), k in zip(crit_rows, keys):
        a = cr.cell(row=r, column=1, value=rotulo)
        if valor is None:
            a.font = F_SUB
            r += 1
            continue
        a.font = F_BASE
        b = cr.cell(row=r, column=2, value=valor)
        b.font, b.fill = F_DADO, FILL_PARAM
        b.number_format = "0%" if unidade == "%" else "#,##0"
        cr.cell(row=r, column=3, value="" if unidade == "%" else unidade).font = F_BASE
        ref_cell[k] = f"'Critérios'!$B${r}"
        r += 1
    cr.cell(row=r + 1, column=1, value="Nota máxima: 30 (tamanho) + 35 (variação) + 20 (fibra) + 15 (residencial) = 100 pontos.").font = F_BASE

    C = ref_cell

    # ------------------------------------------------------------------ Provedores
    pv = wb.create_sheet("Provedores")
    cols = ["Empresa", "CNPJ", "Grupo econômico", "UF", "Município principal", "Municípios atendidos",
            f"Acessos {ref}", f"Acessos {ref_ant}", "Variação 6 meses", "% fibra", "% pessoa física",
            "Pts tamanho", "Pts variação", "Pts fibra", "Pts residencial", "Nota (0–100)", "Prioridade",
            "Buscar contato", "Etapa", "Observações"]
    larg = [34, 20, 16, 6, 24, 11, 12, 12, 11, 9, 11, 9, 9, 8, 11, 10, 11, 12, 18, 36]
    cabecalho(pv, 1, cols, larg)
    pv.freeze_panes = "B2"
    n = len(alvo)
    for i, e in enumerate(alvo, 2):
        g, h = e["total"], e["total_marco"]
        vals = [e["empresa"], cnpj_fmt(e["cnpj"]), e["grupo"].title() if e["grupo"] not in ("OUTROS", "") else "—",
                e["uf_principal"], e["municipio_principal"], e["n_municipios"], g, h if h else None,
                None, round(e["fibra"] / g, 4) if g else 0, round(e["pf"] / g, 4) if g else 0]
        for j, v in enumerate(vals, 1):
            c = pv.cell(row=i, column=j, value=v)
            c.font = F_DADO if j in (1, 2, 3, 4, 5, 6, 7, 8, 10, 11) else F_BASE
        pv.cell(row=i, column=9, value=f'=IF(H{i}>0,G{i}/H{i}-1,"")')
        pv.cell(row=i, column=12, value=(f"=IF(AND(G{i}>={C['ideal_min']},G{i}<={C['ideal_max']}),{C['pts_ideal']},"
                                         f"IF(G{i}>{C['ideal_max']},{C['pts_grande']},IF(G{i}>={C['medio_min']},{C['pts_medio']},{C['pts_pequeno']})))"))
        pv.cell(row=i, column=13, value=(f'=IF(I{i}="",{C["pts_sem"]},IF(ABS(I{i})>{C["atipico"]},{C["pts_sem"]},'
                                         f'IF(I{i}<={C["perda_forte"]},{C["pts_perda_forte"]},IF(I{i}<=0,{C["pts_perda"]},'
                                         f'IF(I{i}<={C["cresc_leve"]},{C["pts_cresc_leve"]},{C["pts_cresc"]})))))'))
        pv.cell(row=i, column=14, value=(f"=IF(J{i}>={C['fibra_alta']},{C['pts_fibra_alta']},"
                                         f"IF(J{i}>={C['fibra_media']},{C['pts_fibra_media']},{C['pts_fibra_baixa']}))"))
        pv.cell(row=i, column=15, value=f"=IF(K{i}>={C['res_alta']},{C['pts_res_alta']},{C['pts_res_baixa']})")
        pv.cell(row=i, column=16, value=f"=SUM(L{i}:O{i})")
        pv.cell(row=i, column=17, value=f'=IF(P{i}>={C["alta"]},"Alta",IF(P{i}>={C["media"]},"Média","Baixa"))')
        busca = quote(f'{e["empresa"]} provedor de internet {e["municipio_principal"]} {e["uf_principal"]}')
        link = pv.cell(row=i, column=18, value="Buscar")
        link.hyperlink = f"https://www.google.com/search?q={busca}"
        link.font = F_LINK
        for j in (19, 20):
            pv.cell(row=i, column=j).fill = FILL_PREENCHER
        for j in range(9, 18):
            pv.cell(row=i, column=j).font = F_BASE
        pv.cell(row=i, column=6).number_format = "#,##0"
        pv.cell(row=i, column=7).number_format = "#,##0"
        pv.cell(row=i, column=8).number_format = "#,##0;-#,##0;-"
        pv.cell(row=i, column=9).number_format = "+0.0%;-0.0%;0.0%"
        pv.cell(row=i, column=10).number_format = "0%"
        pv.cell(row=i, column=11).number_format = "0%"
    last = n + 1
    pv.auto_filter.ref = f"A1:T{last}"
    dv = DataValidation(type="list", formula1='"' + ",".join(ETAPAS) + '"', allow_blank=True)
    pv.add_data_validation(dv)
    dv.add(f"S2:S{last}")
    pv.conditional_formatting.add(f"Q2:Q{last}", CellIsRule(operator="equal", formula=['"Alta"'], fill=PatternFill("solid", fgColor="DFF5EA")))
    pv["H1"].comment = Comment("Vazio quando a empresa não declarou acessos no mês de comparação.", "RETENZA")
    pv["I1"].comment = Comment(f"Acessos de {ref} sobre {ref_ant}. Perda líquida é indício de cancelamentos acima das vendas; "
                               "variações muito grandes costumam ser ajuste de declaração ou transferência de base entre CNPJs.", "RETENZA")
    pv["C1"].comment = Comment("Grupo econômico declarado à Anatel. Empresas de grupos com mais de 30.000 acessos somados ficaram de fora.", "RETENZA")

    # ------------------------------------------------------------------ Prioritários
    pr = wb.create_sheet("Prioritários", 1)
    pr["A1"] = "30 provedores prioritários para a primeira rodada de contatos"
    pr["A1"].font = F_TITULO
    pr["A2"] = (f"Os 30 de maior nota na base nacional (empate: maior base de assinantes), com os critérios padrão de {ref}. "
                "Para focar numa região, filtre a aba Provedores pela coluna UF e siga a mesma ordem.")
    pr["A2"].font = F_BASE
    pcols = ["#", "Empresa", "CNPJ", "UF", "Município principal", f"Acessos {ref}", "Variação 6 meses", "Nota", "Prioridade",
             "Buscar contato", "Contato encontrado", "Etapa", "Observações"]
    plarg = [5, 34, 20, 6, 24, 12, 12, 8, 11, 12, 30, 18, 36]
    cabecalho(pr, 4, pcols, plarg)
    pr.freeze_panes = "C5"
    for k, e in enumerate(alvo[:30], 1):
        r = k + 4
        pr.cell(row=r, column=1, value=k).font = F_BASE
        pr.cell(row=r, column=2, value=f"=Provedores!A{k + 1}").font = Font(name=ARIAL, size=10, color="008000")
        pr.cell(row=r, column=3, value=f"=Provedores!B{k + 1}").font = Font(name=ARIAL, size=10, color="008000")
        pr.cell(row=r, column=4, value=f"=Provedores!D{k + 1}").font = Font(name=ARIAL, size=10, color="008000")
        pr.cell(row=r, column=5, value=f"=Provedores!E{k + 1}").font = Font(name=ARIAL, size=10, color="008000")
        c = pr.cell(row=r, column=6, value=f"=Provedores!G{k + 1}")
        c.font, c.number_format = Font(name=ARIAL, size=10, color="008000"), "#,##0"
        c = pr.cell(row=r, column=7, value=f"=Provedores!I{k + 1}")
        c.font, c.number_format = Font(name=ARIAL, size=10, color="008000"), "+0.0%;-0.0%;0.0%"
        pr.cell(row=r, column=8, value=f"=Provedores!P{k + 1}").font = Font(name=ARIAL, size=10, color="008000")
        pr.cell(row=r, column=9, value=f"=Provedores!Q{k + 1}").font = Font(name=ARIAL, size=10, color="008000")
        busca = quote(f'{e["empresa"]} provedor de internet {e["municipio_principal"]} {e["uf_principal"]}')
        link = pr.cell(row=r, column=10, value="Buscar")
        link.hyperlink, link.font = f"https://www.google.com/search?q={busca}", F_LINK
        for j in (11, 12, 13):
            pr.cell(row=r, column=j).fill = FILL_PREENCHER
            pr.cell(row=r, column=j).font = F_BASE
    dv2 = DataValidation(type="list", formula1='"' + ",".join(ETAPAS) + '"', allow_blank=True)
    pr.add_data_validation(dv2)
    dv2.add("L5:L34")

    # ------------------------------------------------------------------ Por estado
    pe = wb.create_sheet("Por estado", 2)
    pe["A1"] = "Provedores no perfil do piloto, por estado"
    pe["A1"].font = F_TITULO
    pe["A2"] = "Estado de maior número de acessos de cada empresa. Contagens recalculadas a partir da aba Provedores."
    pe["A2"].font = F_BASE
    cabecalho(pe, 4, ["UF", "Estado", "Provedores no perfil", "Prioridade alta", "Prioridade média", "Acessos somados"],
              [6, 22, 12, 11, 11, 14])
    pe.freeze_panes = "A5"
    ordem = [uf for uf, _ in Counter(e["uf_principal"] for e in alvo).most_common()]
    for k, uf in enumerate(ordem, 5):
        pe.cell(row=k, column=1, value=uf).font = F_DADO
        pe.cell(row=k, column=2, value=UF_NOME.get(uf, uf)).font = F_DADO
        pe.cell(row=k, column=3, value=f"=COUNTIF(Provedores!$D$2:$D${last},A{k})").font = F_BASE
        pe.cell(row=k, column=4, value=f'=COUNTIFS(Provedores!$D$2:$D${last},A{k},Provedores!$Q$2:$Q${last},"Alta")').font = F_BASE
        pe.cell(row=k, column=5, value=f'=COUNTIFS(Provedores!$D$2:$D${last},A{k},Provedores!$Q$2:$Q${last},"Média")').font = F_BASE
        c = pe.cell(row=k, column=6, value=f"=SUMIF(Provedores!$D$2:$D${last},A{k},Provedores!$G$2:$G${last})")
        c.font, c.number_format = F_BASE, "#,##0"
    tot = len(ordem) + 5
    pe.cell(row=tot, column=1, value="Total").font = F_SUB
    for col in (3, 4, 5, 6):
        L = get_column_letter(col)
        c = pe.cell(row=tot, column=col, value=f"=SUM({L}5:{L}{tot - 1})")
        c.font, c.number_format = F_SUB, "#,##0"
        c.border = Border(top=Side(style="thin", color="141B26"))

    # ------------------------------------------------------------------ Como usar
    cu = wb.create_sheet("Como usar", 0)
    cu.column_dimensions["A"].width = 120
    linhas = [
        ("RETENZA · Provedores-alvo para o piloto", F_TITULO),
        (f"Base: acessos de banda larga fixa declarados à Anatel, mês de referência {ref} (comparação com {ref_ant}).", F_BASE),
        (f"Fonte: Anatel, Dados Abertos, Acessos de Banda Larga Fixa (arquivo de {ano}), {FONTE_URL}", F_BASE),
        ("", F_BASE),
        ("O que entrou na lista", F_SUB),
        (f"• {n:,} empresas com 1.000 a 30.000 acessos em {ref}, contadas por CNPJ.".replace(",", "."), F_BASE),
        (f"• Ficaram de fora as prestadoras de grande porte e {excluidos_grupo} empresas de grupos econômicos com mais de 30.000 acessos somados.", F_BASE),
        ("• UF e município principal = onde a empresa tem mais acessos. Muitas atendem várias cidades.", F_BASE),
        ("", F_BASE),
        ("Como a nota de prioridade funciona (0 a 100)", F_SUB),
        ("• Tamanho: bases de 3.000 a 15.000 acessos têm dados suficientes e decidem rápido.", F_BASE),
        ("• Variação em 6 meses: perda líquida de assinantes é indício de que os cancelamentos superam as vendas, a dor que o RETENZA resolve.", F_BASE),
        ("  Variações acima de 25% para mais ou para menos são tratadas como atípicas (costumam ser ajuste de declaração ou base transferida entre CNPJs).", F_BASE),
        ("• Fibra: provedores com fibra até a casa tendem a ter operação e sistema de gestão mais estruturados.", F_BASE),
        ("• Base residencial: o RETENZA foi pensado para assinantes pessoa física.", F_BASE),
        ("• Os pesos e limites estão na aba Critérios e podem ser alterados. A nota é um ponto de partida para escolher quem contatar, não uma avaliação da empresa.", F_BASE),
        ("", F_BASE),
        ("Como usar as abas", F_SUB),
        ("• Prioritários: os 30 primeiros da base nacional. Comece por aqui se ainda não escolheu uma região.", F_BASE),
        ("• Provedores: todos os provedores no perfil, já ordenados pela nota. Use o filtro da coluna UF para ver só a sua região.", F_BASE),
        ("• Por estado: quantos provedores no perfil existem em cada estado.", F_BASE),
        ("• Critérios: os parâmetros da nota.", F_BASE),
        ("", F_BASE),
        ("O que preencher (células amarelas)", F_SUB),
        ("• Contato encontrado: telefone, WhatsApp, e-mail ou site achados pelo link Buscar. Exemplo: (73) 99999-0000 · comercial@provedor.com.br", F_BASE),
        ("• Etapa: escolha na lista (A contatar, Mensagem enviada, Conversa marcada, Conversa feita, Piloto proposto, Parceiro, Descartado).", F_BASE),
        ("• Observações: o que aconteceu no contato. Exemplo: Falei com o sócio, pediu retorno na segunda depois das 14h.", F_BASE),
        ("", F_BASE),
        ("Cores: azul = dado da Anatel · preto = fórmula · verde = valor puxado de outra aba · amarelo = para você preencher ou ajustar.", F_BASE),
        ("Limites dos dados: são números declarados pelas próprias empresas à Anatel, sem telefone ou e-mail. Confira nome e cidade antes do contato.", F_BASE),
    ]
    for k, (txt, fnt) in enumerate(linhas, 1):
        c = cu.cell(row=k, column=1, value=txt)
        c.font = fnt
        c.alignment = Alignment(wrap_text=True, vertical="top")

    for ws in wb.worksheets:
        ws.sheet_view.showGridLines = ws.title not in ("Como usar", "Critérios")
    wb.active = 0
    wb.save(out)
    print(f"{n} provedores; prioritários: {[e['empresa'] for e in alvo[:3]]}...")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
