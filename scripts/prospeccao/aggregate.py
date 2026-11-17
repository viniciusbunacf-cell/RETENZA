"""Soma os acessos de banda larga fixa por CNPJ nos meses pedidos, lendo o zip remoto em streaming."""
import io, sys, csv, json, zipfile, time
from collections import defaultdict
sys.path.insert(0, sys.argv[1])
from httpzip import HttpFile
url, member, out = sys.argv[2], sys.argv[3], sys.argv[4]
MAIN, PREV = 9, 3

def num(s):
    try: return int(s)
    except ValueError: return int(float(s.replace(",", ".")))

agg = {}
prev = defaultdict(int)
group_total = defaultdict(int)
t0 = time.time()
z = zipfile.ZipFile(io.BufferedReader(HttpFile(url), buffer_size=8 << 20))
with z.open(member) as f:
    r = csv.reader(io.TextIOWrapper(f, encoding="utf-8-sig", errors="replace", newline=""), delimiter=";")
    header = next(r)
    idx = {h: i for i, h in enumerate(header)}
    for n, row in enumerate(r, 1):
        if n % 2_000_000 == 0:
            print(f"{n:,} linhas, {time.time()-t0:.0f}s", flush=True)
        try:
            mes = int(row[idx["Mês"]]); qtd = num(row[idx["Acessos"]])
        except (ValueError, IndexError):
            continue
        cnpj = row[idx["CNPJ"]]
        if mes == PREV:
            prev[cnpj] += qtd
            continue
        if mes != MAIN:
            continue
        a = agg.get(cnpj)
        if a is None:
            a = agg[cnpj] = {"empresa": row[idx["Empresa"]], "grupo": row[idx["Grupo Econômico"]], "porte": row[idx["Porte da Prestadora"]],
                             "total": 0, "fibra": 0, "pf": 0, "mun": defaultdict(int), "uf": defaultdict(int)}
        a["total"] += qtd
        group_total[row[idx["Grupo Econômico"]]] += qtd
        if row[idx["Tecnologia"]].upper() in ("FTTH", "FTTB", "FTTP") or "fibra" in row[idx["Meio de Acesso"]].lower():
            a["fibra"] += qtd
        if row[idx["Tipo de Pessoa"]] == "Pessoa Física":
            a["pf"] += qtd
        a["mun"][(row[idx["UF"]], row[idx["Município"]], row[idx["Código IBGE Município"]])] += qtd
        a["uf"][row[idx["UF"]]] += qtd

res = []
for cnpj, a in agg.items():
    muns = sorted(a["mun"].items(), key=lambda kv: -kv[1])
    ufs = sorted(a["uf"].items(), key=lambda kv: -kv[1])
    res.append({"cnpj": cnpj, "empresa": a["empresa"], "grupo": a["grupo"], "porte": a["porte"], "total": a["total"],
                "total_marco": prev.get(cnpj, 0), "fibra": a["fibra"], "pf": a["pf"],
                "uf_principal": ufs[0][0], "ufs": [u for u, _ in ufs],
                "municipio_principal": muns[0][0][1], "ibge_principal": muns[0][0][2], "acessos_mun_principal": muns[0][1],
                "n_municipios": len(muns),
                "top_municipios": [[m[0], m[1], q] for m, q in muns[:5]]})
json.dump({"mes": MAIN, "mes_anterior": PREV, "ano": 2026, "linhas": n, "empresas": res,
           "grupos": group_total}, open(out, "w"), ensure_ascii=False)
print(f"fim: {n:,} linhas, {len(res)} empresas em {MAIN}/2026, {time.time()-t0:.0f}s")
