/** A régua do índice — pesos, réguas, fontes, limites e o desenho do radial.
 *
 *  A RÉGUA É CONFIGURAÇÃO DA ORGANIZAÇÃO, e não preferência de quem olha:
 *  mudar aqui muda o número que todo mundo lê. Por isso é versionada, e só
 *  quem administra cadastros grava — o servidor recusa o resto.
 *
 *  MORAVA EM `Score.tsx`, como aba. Saiu de lá quando a Calibração deixou de
 *  ser uma forma de LER o índice e passou a ser a engrenagem do Score: o
 *  arquivo ficou com dois donos, e um deles nem o montava mais.
 */

import { useEffect, useRef, useState } from 'react';

import {
  gravarCalibracao,
  importarPlanilhaDoScore,
  listarFontesDoScore,
  restaurarCalibracaoPadrao,
} from '@/api/cliente';
import {
  Botao,
  Campo,
  Cartao,
  Chip,
  FaixaDeErro,
  Secao,
  estiloDeEntrada,
} from '@/componentes/basicos';
import { GuiaDoParametro } from '@/componentes/GuiaDoParametro';
import { numero } from '@/dominio/formato';
import {
  ROTULO_DA_REGUA_DE_ENGAJAMENTO,
  ROTULO_DA_REGUA_DE_TIER,
  ROTULO_DO_AVISO,
  ROTULO_DO_DESCARTE,
  comLimiteAjustado,
  comoLimite,
  limitesAjustados,
} from '@/dominio/score';
import type {
  Calibracao,
  CalibracaoEntrada,
  FonteDoScore,
  ImportacaoDoScore,
  LimiteDaCalibracao,
  OpcoesDoScore,
} from '@/dominio/score';

//: A RÉGUA É CONFIGURAÇÃO DA ORGANIZAÇÃO, e não preferência de quem olha:
//: mudar aqui muda o número que todo mundo lê. Por isso é versionada e só
//: quem administra cadastros grava — o servidor recusa o resto.
export function CalibracaoDoScore({
  mes,
  opcoes,
  calibracao,
  aoMudar,
}: {
  mes: string;
  opcoes: OpcoesDoScore;
  calibracao: Calibracao;
  aoMudar: () => Promise<void>;
}) {
  const [fontes, definirFontes] = useState<FonteDoScore[]>([]);
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [importando, definirImportando] = useState<string | null>(null);
  const entradaDePlanilha = useRef<HTMLInputElement>(null);
  //: Qual fonte pediu o arquivo. Em `ref`, e não em estado: ele é lido no
  //: `change` do input e não precisa redesenhar nada ao mudar.
  const fonteEscolhida = useRef<string | null>(null);
  const [importado, definirImportado] = useState<ImportacaoDoScore[] | null>(null);

  useEffect(() => {
    let ativo = true;
    listarFontesDoScore(mes)
      .then((carregadas) => ativo && definirFontes(carregadas))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [mes, calibracao]);

  // A ENTRADA NÃO É UMA `Calibracao` PARCIAL, e a diferença não é de forma: a
  // saída traz os oito limites com o de fábrica ao lado, e a entrada leva só
  // o que foi mexido. Tipar os dois igual deixaria a lista inteira ser gravada
  // como se fosse ajuste.
  async function gravar(mudanca: CalibracaoEntrada) {
    definirSalvando(true);
    definirErro(null);
    try {
      await gravarCalibracao({
        pesos: mudanca.pesos ?? calibracao.pesos,
        regua_tier: mudanca.regua_tier ?? calibracao.regua_tier,
        regua_engajamento: mudanca.regua_engajamento ?? calibracao.regua_engajamento,
        fontes_desligadas: mudanca.fontes_desligadas ?? calibracao.fontes_desligadas,
        limites: mudanca.limites ?? limitesAjustados(calibracao.limites),
        radial_por_peso: mudanca.radial_por_peso ?? calibracao.radial_por_peso,
      });
      // ESPERA A RÉGUA NOVA CHEGAR antes de liberar os campos: eles montam o
      // payload a partir das props, e liberar antes abriria uma janela em que
      // a segunda edição desfaz a primeira.
      await aoMudar();
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : 'Não foi possível gravar.');
    } finally {
      definirSalvando(false);
    }
  }

  function escolherPlanilha(codigo: string) {
    fonteEscolhida.current = codigo;
    entradaDePlanilha.current?.click();
  }

  async function importar(codigo: string, arquivo: File) {
    definirImportando(codigo);
    definirErro(null);
    definirImportado(null);
    try {
      definirImportado(await importarPlanilhaDoScore(codigo, arquivo));
      // O índice do mês muda com o arquivo: recarregar a página inteira é o
      // que impede a tela de mostrar o número velho ao lado do resumo novo.
      aoMudar();
    } catch (falha) {
      definirErro(
        falha instanceof Error ? falha.message : 'Não foi possível ler a planilha.',
      );
    } finally {
      definirImportando(null);
    }
  }

  const alternarFonte = (codigo: string) =>
    gravar({
      fontes_desligadas: calibracao.fontes_desligadas.includes(codigo)
        ? calibracao.fontes_desligadas.filter((f) => f !== codigo)
        : [...calibracao.fontes_desligadas, codigo],
    });

  const mudarPeso = (lente: string, passo: number) => {
    const atual = calibracao.pesos[lente] ?? 0;
    const proximo = Math.min(60, Math.max(0, atual + passo));
    if (proximo === atual) return;
    gravar({ pesos: { ...calibracao.pesos, [lente]: proximo } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {erro ? <FaixaDeErro mensagem={erro} /> : null}

      <Secao
        titulo="Régua de ponderação"
        subtitulo="Mudar aqui recalcula o índice inteiro, de todos os meses — e fica gravado como uma versão nova, com autor e data."
        acao={
          <Botao
            variante="secundario"
            aoClicar={() =>
              restaurarCalibracaoPadrao()
                .then(() => aoMudar())
                .catch((falha: unknown) =>
                  definirErro(
                    falha instanceof Error ? falha.message : 'Não foi possível restaurar.',
                  ),
                )
            }
            desabilitado={salvando || calibracao.padrao}
          >
            Restaurar padrão
          </Botao>
        }
      >
        <div className="grade grade--2" style={{ gap: 16, alignItems: 'start' }}>
          <Cartao>
            <Campo
              rotulo="Relevância do veículo"
              dica="Quanto vale uma matéria conforme o tier do veículo. Vale para Imprensa e Mercado."
              aoLadoDoRotulo={<GuiaDoParametro chave="regua_tier" />}
            >
              <select
                value={calibracao.regua_tier}
                onChange={(evento) => gravar({ regua_tier: evento.target.value })}
                disabled={salvando}
                style={estiloDeEntrada}
              >
                {opcoes.reguas_de_tier.map((regua) => (
                  <option key={regua.codigo} value={regua.codigo}>
                    {ROTULO_DA_REGUA_DE_TIER[regua.codigo] ?? regua.codigo}
                  </option>
                ))}
              </select>
            </Campo>
            <p style={{ fontSize: 11.5, color: 'var(--cinza-2)', margin: '10px 0 0' }}>
              <strong>Muito Relevante</strong> = grande imprensa nacional, econômica e trade.{' '}
              <strong>Relevante</strong> = regionais com influência.{' '}
              <strong>Menos Relevante</strong> = locais e blogs de nicho. A classificação é da
              própria clipagem, e não desta tela. As lentes de redes não têm tier: nelas esta
              régua não muda nada.
            </p>
          </Cartao>

          <Cartao>
            <Campo
              rotulo="Peso de cada menção nas redes"
              dica="Vale para Sociedade digital e Clientes."
              aoLadoDoRotulo={<GuiaDoParametro chave="regua_engajamento" />}
            >
              <select
                value={calibracao.regua_engajamento}
                onChange={(evento) => gravar({ regua_engajamento: evento.target.value })}
                disabled={salvando}
                style={estiloDeEntrada}
              >
                {opcoes.reguas_de_engajamento.map((codigo) => (
                  <option key={codigo} value={codigo}>
                    {ROTULO_DA_REGUA_DE_ENGAJAMENTO[codigo] ?? codigo}
                  </option>
                ))}
              </select>
            </Campo>
            <p style={{ fontSize: 11.5, color: 'var(--cinza-2)', margin: '10px 0 0' }}>
              Approach e Bites trazem o engajamento de cada menção; só a Bites traz o cargo de
              autores políticos — nas outras fontes a régua <em>cargo</em> cai na contagem.
              Nenhuma das duas traz alcance ou número de seguidores.
            </p>
          </Cartao>
        </div>
      </Secao>

      <Secao
        titulo="Peso das lentes"
        subtitulo="De 0 a 60, de 5 em 5. Peso 0 tira a lente do índice — as outras redistribuem."
        acao={<GuiaDoParametro chave="pesos" />}
      >
        <Cartao>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {opcoes.lentes.map((lente) => (
              <li
                key={lente.codigo}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderTop: '1px solid var(--borda)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{lente.nome}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--cinza-2)' }}>
                    {lente.stakeholder} · padrão {lente.peso_padrao}
                  </div>
                </div>
                <Botao
                  variante="fantasma"
                  aoClicar={() => mudarPeso(lente.codigo, -5)}
                  desabilitado={salvando}
                  rotuloAcessivel={`Diminuir o peso de ${lente.nome}`}
                >
                  −
                </Botao>
                <span
                  className="tabular"
                  style={{ fontSize: 16, fontWeight: 700, minWidth: 28, textAlign: 'center' }}
                >
                  {calibracao.pesos[lente.codigo] ?? lente.peso_padrao}
                </span>
                <Botao
                  variante="fantasma"
                  aoClicar={() => mudarPeso(lente.codigo, 5)}
                  desabilitado={salvando}
                  rotuloAcessivel={`Aumentar o peso de ${lente.nome}`}
                >
                  +
                </Botao>
              </li>
            ))}
          </ul>
        </Cartao>
      </Secao>

      <Secao
        titulo="Fontes"
        subtitulo="Importar substitui os meses que a planilha traz — o mês que ela não traz fica intacto. Desligar uma fonte tira o dado dela do índice sem apagar o histórico; com todas as fontes de uma lente desligadas, a lente sai do cálculo e os pesos redistribuem."
        acao={<GuiaDoParametro chave="fontes" />}
      >
        <Cartao>
          {/* UM `<input type="file">` PARA A SEÇÃO, acionado pelo botão da
              linha. Antes era um por fonte, escondido com `display: none`
              dentro de um `<label>` — o que tira o elemento da ordem de foco e
              deixava "Importar planilha" inalcançável por teclado. Um `Botao`
              de verdade resolve isso e ainda usa o estilo da casa; o input
              fica só como mecanismo, sem receber foco. */}
          <input
            ref={entradaDePlanilha}
            type="file"
            accept=".xlsx"
            tabIndex={-1}
            aria-hidden
            style={{ display: 'none' }}
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0];
              // O input é limpo SEMPRE: sem isto, escolher o mesmo arquivo de
              // novo (depois de corrigi-lo) não dispara `change`, e a tela
              // parece travada.
              evento.target.value = '';
              const codigo = fonteEscolhida.current;
              if (arquivo && codigo) void importar(codigo, arquivo);
            }}
          />

          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {fontes.map((fonte) => (
              <li
                key={fonte.codigo}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderTop: '1px solid var(--borda)',
                  opacity: fonte.ligada ? 1 : 0.55,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {fonte.nome}
                    {fonte.interna ? (
                      <Chip rotulo="interna" estilo={{ marginLeft: 8 }} />
                    ) : null}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--cinza-2)' }}>
                    {fonte.lente} · {fonte.meses_com_dado}{' '}
                    {fonte.meses_com_dado === 1 ? 'mês com dado' : 'meses com dado'}
                    {fonte.mencoes_no_mes
                      ? ` · ${numero(fonte.mencoes_no_mes)} no mês`
                      : ' · sem dado no mês'}
                  </div>
                  {fonte.observacao ? (
                    <div style={{ fontSize: 11.5, color: 'var(--cinza-2)' }}>
                      {fonte.observacao}
                    </div>
                  ) : null}
                </div>
                {/* A FONTE INTERNA NÃO TEM BOTÃO DE IMPORTAR: o CRM é este
                    banco, e oferecer o upload sugeriria que existe uma
                    planilha dele em algum lugar. */}
                {fonte.interna ? null : (
                  <Botao
                    variante="fantasma"
                    aoClicar={() => escolherPlanilha(fonte.codigo)}
                    desabilitado={importando !== null}
                  >
                    {importando === fonte.codigo ? 'Lendo…' : 'Importar planilha'}
                  </Botao>
                )}
                <Botao
                  variante="fantasma"
                  aoClicar={() => alternarFonte(fonte.codigo)}
                  desabilitado={salvando}
                >
                  {fonte.ligada ? 'Desligar' : 'Ligar'}
                </Botao>
              </li>
            ))}
          </ul>

          {importado?.map((resumo) => (
            <ResumoDaImportacao key={resumo.fonte} resumo={resumo} />
          ))}
        </Cartao>
      </Secao>

      <LimitesDosSinais
        limites={calibracao.limites}
        salvando={salvando}
        aoGravar={(limites) => gravar({ limites })}
      />

      <Secao
        titulo="Gráfico da Visão geral"
        subtitulo="Como as cinco lentes se desenham no radial. O comprimento da fatia é sempre a nota; o que se escolhe aqui é a largura."
      >
        <Cartao>
          <Campo
            rotulo="Largura da fatia"
            dica="Fatias iguais escondem a ponderação que o índice aplicou: uma lente de peso 15 passa a parecer valer tanto quanto a de 30."
            aoLadoDoRotulo={<GuiaDoParametro chave="radial_por_peso" />}
          >
            <select
              style={estiloDeEntrada}
              value={calibracao.radial_por_peso ? 'peso' : 'iguais'}
              disabled={salvando}
              onChange={(evento) =>
                gravar({ radial_por_peso: evento.target.value === 'peso' })
              }
            >
              <option value="peso">Peso da lente no índice — como a média pondera</option>
              <option value="iguais">Fatias iguais — só a nota se compara</option>
            </select>
          </Campo>
        </Cartao>
      </Secao>
    </div>
  );
}

/** Os cortes de cada detector de sinal.
 *
 *  ISTO NÃO É CONSTANTE TÉCNICA. "O que conta como pico" depende do volume que
 *  cada fonte costuma trazer, e quem sabe isso é quem lê o painel toda semana —
 *  não quem escreveu o detector. Com os limites no código, ajustar um corte
 *  exigiria deploy; aqui, a frase muda na próxima leitura da lente.
 */
function LimitesDosSinais({
  limites,
  salvando,
  aoGravar,
}: {
  limites: LimiteDaCalibracao[];
  salvando: boolean;
  aoGravar: (limites: Record<string, number>) => void;
}) {
  if (!limites.length) return null;

  return (
    <Secao
      titulo="Limites dos sinais"
      subtitulo="O que cada detector precisa ver para escrever uma frase na lente. Mudar aqui muda o texto do dossiê na próxima leitura — sem deploy, e sem reescrever nada à mão."
    >
      <div className="grade grade--2" style={{ gap: 16, alignItems: 'start' }}>
        {limites.map((limite) => (
          <CampoDeLimite
            key={limite.chave}
            limite={limite}
            salvando={salvando}
            aoGravar={(valor) => aoGravar(comLimiteAjustado(limites, limite.chave, valor))}
          />
        ))}
      </div>
    </Secao>
  );
}

/** Um corte, com o de fábrica ao lado quando ele foi mexido.
 *
 *  GRAVA AO SAIR DO CAMPO, e não a cada tecla: a tabela da calibração só
 *  cresce, e um PUT por caractere encheria o histórico de versões com os
 *  estados intermediários de quem estava digitando "12". */
function CampoDeLimite({
  limite,
  salvando,
  aoGravar,
}: {
  limite: LimiteDaCalibracao;
  salvando: boolean;
  aoGravar: (valor: number) => void;
}) {
  const escrito = (valor: number) => String(valor).replace('.', ',');
  const [texto, definirTexto] = useState(escrito(limite.valor));

  // O servidor é quem manda: depois de gravar, o valor volta de lá, e um
  // rascunho preso no campo faria a tela discordar do que está gravado.
  useEffect(() => definirTexto(escrito(limite.valor)), [limite.valor]);

  function confirmar() {
    const valor = comoLimite(texto, limite.formato);
    if (valor === null) {
      definirTexto(escrito(limite.valor));
      return;
    }
    if (valor === limite.valor) {
      definirTexto(escrito(valor));
      return;
    }
    aoGravar(valor);
  }

  const ajustado = limite.valor !== limite.padrao;
  return (
    <Cartao>
      <Campo
        rotulo={limite.rotulo}
        dica={limite.explicacao}
        aoLadoDoRotulo={<GuiaDoParametro chave={limite.chave} />}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            className="tabular"
            inputMode="decimal"
            value={texto}
            disabled={salvando}
            style={{ ...estiloDeEntrada, width: 110 }}
            onChange={(evento) => definirTexto(evento.target.value)}
            onBlur={confirmar}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') evento.currentTarget.blur();
              if (evento.key === 'Escape') definirTexto(escrito(limite.valor));
            }}
          />
          {limite.unidade ? (
            <span style={{ fontSize: 12.5, color: 'var(--cinza-2)' }}>{limite.unidade}</span>
          ) : null}
          {ajustado ? (
            <Chip rotulo={`padrão ${escrito(limite.padrao)}`} titulo="Valor de fábrica" />
          ) : null}
        </div>
      </Campo>
    </Cartao>
  );
}

/** O que a planilha rendeu numa fonte — com os descartes, e não só o que entrou.
 *
 *  UM RESUMO POR FONTE, porque um arquivo alimenta mais de uma. É aqui que
 *  quem subiu o export da Clipei descobre que Mercado também foi atualizado. */
function ResumoDaImportacao({ resumo }: { resumo: ImportacaoDoScore }) {
  const descartados = Object.entries(resumo.descartes).filter(([, total]) => total > 0);
  const avisados = Object.entries(resumo.avisos).filter(([, total]) => total > 0);
  // O mês encolheu: o arquivo trouxe menos do que já havia. Pode ser
  // reclassificação do fornecedor, pode ser export baixado antes do
  // fechamento — a tela não adivinha, mas não deixa passar em branco.
  const encolheu = resumo.antes > resumo.ingeridas;

  return (
    <div
      style={{
        marginTop: 12,
        padding: '10px 12px',
        borderRadius: 6,
        background: encolheu ? 'var(--atencao-bg)' : 'var(--ok-bg)',
        fontSize: 12,
        lineHeight: 1.6,
      }}
    >
      <strong>{resumo.nome}:</strong> {numero(resumo.ingeridas)} de{' '}
      {numero(resumo.linhas)} linhas entraram em {resumo.meses.join(', ')}.
      {encolheu ? (
        <>
          {' '}
          <strong>
            O mês tinha {numero(resumo.antes)} — confira se o arquivo é o
            fechado.
          </strong>
        </>
      ) : null}
      {descartados.length ? (
        <>
          {' '}
          Fora:{' '}
          {descartados
            .map(
              ([motivo, total]) =>
                `${numero(total)} ${ROTULO_DO_DESCARTE[motivo] ?? motivo}`,
            )
            .join('; ')}
          .
        </>
      ) : null}
      {avisados.length ? (
        <>
          {' '}
          Entraram com ressalva:{' '}
          {avisados
            .map(
              ([motivo, total]) => `${numero(total)} ${ROTULO_DO_AVISO[motivo] ?? motivo}`,
            )
            .join('; ')}
          .
        </>
      ) : null}
    </div>
  );
}
