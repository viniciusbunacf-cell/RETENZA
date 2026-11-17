"""Regras da nota de prioridade (as mesmas que a planilha aplica em fórmulas)."""
P = dict(ideal_min=3000, ideal_max=15000, medio_min=2000, pts_ideal=30, pts_grande=25, pts_medio=20, pts_pequeno=10,
         atipico=0.25, perda_forte=-0.05, cresc_leve=0.05, pts_perda_forte=35, pts_perda=25, pts_cresc_leve=15, pts_cresc=5, pts_sem=10,
         fibra_alta=0.8, fibra_media=0.5, pts_fibra_alta=20, pts_fibra_media=12, pts_fibra_baixa=5,
         res_alta=0.8, pts_res_alta=15, pts_res_baixa=8, alta=75, media=55)

def pontos(e):
    g, h = e["total"], e["total_marco"]
    t = P["pts_ideal"] if P["ideal_min"] <= g <= P["ideal_max"] else P["pts_grande"] if g > P["ideal_max"] else P["pts_medio"] if g >= P["medio_min"] else P["pts_pequeno"]
    v = (g / h - 1) if h > 0 else None
    if v is None or abs(v) > P["atipico"]: va = P["pts_sem"]
    elif v <= P["perda_forte"]: va = P["pts_perda_forte"]
    elif v <= 0: va = P["pts_perda"]
    elif v <= P["cresc_leve"]: va = P["pts_cresc_leve"]
    else: va = P["pts_cresc"]
    fb = e["fibra"] / g if g else 0
    f = P["pts_fibra_alta"] if fb >= P["fibra_alta"] else P["pts_fibra_media"] if fb >= P["fibra_media"] else P["pts_fibra_baixa"]
    pf = e["pf"] / g if g else 0
    r = P["pts_res_alta"] if pf >= P["res_alta"] else P["pts_res_baixa"]
    nota = t + va + f + r
    return dict(t=t, va=va, f=f, r=r, nota=nota, v=v, fb=fb, pf=pf,
                prio="Alta" if nota >= P["alta"] else "Média" if nota >= P["media"] else "Baixa")
