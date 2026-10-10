# Validador de referência das invariantes do JSON da Consulta em profundidade.
# Uso: python3 validar_dados.py consulta-profundidade.dados.json
import json,sys
CAMINHO=sys.argv[1] if len(sys.argv)>1 else 'consulta-profundidade.dados.json'
d=json.load(open(CAMINHO, encoding='utf-8'))
erros=[]
def ok(c,msg):
    if not c: erros.append(msg)
L=d['lentes']
ok(abs(sum(l['peso'] for l in L)-1)<1e-9,'pesos não somam 1')
import math
arred=lambda x: math.floor(x+0.5+1e-9)  # meio para cima, igual ao Math.round do JavaScript
isr=[arred(sum(l['peso']*l['serie'][i] for l in L)) for i in range(6)]
ok(isr==[55,63,53,49,51,49],f'ISR calculado {isr} diferente do esperado')
print('ISR calculado',isr)
pt=d['pesoTier']
def sent(n,ctx):
    s=n['sentimento']; ok(s['pos']+s['neu']+s['neg']==100,f'{ctx}: sentimento != 100')
def filhos(pai,ctx):
    f=pai.get('filhos')
    if not f: return
    ok(sum(x['volume'] for x in f)==pai['volume'],f'{ctx}: volume filhos {sum(x["volume"] for x in f)} != {pai["volume"]}')
    ok(abs(sum(x['impacto'] for x in f)-pai['impacto'])<=0.051,f'{ctx}: impacto filhos {sum(x["impacto"] for x in f):.2f} != {pai["impacto"]}')
    ids=[x['id'] for x in f]; ok(len(ids)==len(set(ids)),f'{ctx}: ids duplicados')
for l in L:
    c=l['id']
    ok(l['serie'][-1]==l['nota'],f'{c}: serie[-1] != nota')
    ok(abs(50+sum(p['impacto'] for p in l['pilares'])-l['nota'])<=0.5,f'{c}: 50+Σ impactos != nota')
    ok(sum(p['volume'] for p in l['pilares'])==l['volumeTotal'],f'{c}: Σ volumes pilares != volumeTotal')
    ok(len(l['pilares'])==7,f'{c}: não tem 7 pilares')
    for p in l['pilares']:
        sent(p,f'{c}/{p["id"]}')
        if l['drill']:
            ok('filhos' in p and 'nivel2' in p,f'{c}/{p["id"]}: pilar sem temas')
            filhos(p,f'{c}/{p["id"]}')
            n2=p['nivel2']; de=n2['destaque']; t=[x for x in p['filhos'] if x['id']==de['temaId']]
            ok(len(t)==1,f'{p["id"]}: destaque inexistente'); t=t[0]
            mx=max(p['filhos'],key=lambda x:(abs(x['impacto']),x['volume']))
            ok(mx['id']==t['id'],f'{p["id"]}: destaque não é o de maior |impacto| ({mx["id"]})')
            ev=de['evolucao']; ok(ev['impactos'][-1]==t['impacto'] and ev['volumes'][-1]==t['volume'],f'{p["id"]}: evolução não fecha com o tema')
            for k in ('concessionarias','ufs'):
                cc=de['concentracao'][k]; ok(sum(x['volume'] for x in cc)==t['volume'],f'{p["id"]}/{k}: volume'); ok(abs(sum(x['impacto'] for x in cc)-t['impacto'])<=0.051,f'{p["id"]}/{k}: impacto {sum(x["impacto"] for x in cc)}')
            for t2 in p['filhos']:
                sent(t2,f'{p["id"]}/{t2["id"]}')
                if 'impactoMesAnterior' in t2: ok(abs(ev['impactos'][-2]-t2['impactoMesAnterior'])<1e-9 if t2['id']==t['id'] else True,f'{t2["id"]}: mês anterior')
                if t2.get('filhos'):
                    filhos(t2,f'{t2["id"]}')
                    n3=t2['nivel3']['destaque']; s=[x for x in t2['filhos'] if x['id']==n3['subtemaId']][0]
                    for k in ('tiers','concessionarias'):
                        ok(sum(x['volume'] for x in n3[k]['linhas'])==s['volume'],f'{s["id"]}/{k}: volume'); ok(abs(sum(x['impacto'] for x in n3[k]['linhas'])-s['impacto'])<=0.051,f'{s["id"]}/{k}: impacto')
                    for s2 in t2['filhos']:
                        sent(s2,f'{s2["id"]}')
                        if 'nivel4' in s2:
                            n4=s2['nivel4']; cg=s2['contagens']
                            ok(cg['pos']+cg['neu']+cg['neg']==s2['volume'],f'{s2["id"]}: contagens')
                            ok(sum(n4['porDia']['total'])==s2['volume'],f'{s2["id"]}: porDia total {sum(n4["porDia"]["total"])}')
                            ok(sum(n4['porDia']['negativas'])==cg['neg'],f'{s2["id"]}: porDia neg {sum(n4["porDia"]["negativas"])}')
                            ok(all(a>=b for a,b in zip(n4['porDia']['total'],n4['porDia']['negativas'])),f'{s2["id"]}: neg > total num dia')
                            ok(len(n4['porDia']['total'])==31,f'{s2["id"]}: 31 dias')
                            for it in n4['itens']:
                                sg={'positivo':1,'neutro':0,'negativo':-1}[it['sentimento']]
                                ok(abs(it['impacto']-round(sg*pt[it['tier']]*50/l['totalPonderado'],2))<1e-9,f'{it["id"]}: impacto item')
                            for sname in ('positivo','neutro','negativo'):
                                ok(any(i['sentimento']==sname for i in n4['itens']),f'{s2["id"]}: amostra sem {sname}')
    for cl in l['cartoesLaterais']:
        if cl['tipo']=='oQueMudou':
            ok(abs(cl['de']+sum(x['valor'] for x in cl['linhas'])-cl['para'])<=0.05,f'{c}: oQueMudou não fecha')
            ok(cl['de']==l['serie'][-2],f'{c}: oQueMudou.de != serie[-2]')
            for x in cl['linhas']:
                p=[q for q in l['pilares'] if q['nome']==x['rotulo']][0]
                ok(abs(p['impacto']-p['impactoMesAnterior']-x['valor'])<=0.051,f'{c}: delta {x["rotulo"]}')
print('ERROS:' if erros else 'TODAS AS INVARIANTES OK', *erros, sep='\n')
sys.exit(1 if erros else 0)
