/** A porta de entrada da importação: baixar o modelo e subir o preenchido.
 *
 *  DOIS BOTÕES E NÃO UM, e a ordem é a do trabalho: primeiro se baixa o modelo,
 *  depois se sobe. Um botão só de upload deixaria a pessoa subir a planilha que
 *  ela já tinha, com o formato que ela inventou — e era justamente o medo do
 *  cliente ao pedir a importação: "a ausência de padrão usando esse método".
 *
 *  O MODELO É GERADO A CADA CLIQUE, com o cadastro de agora nas listas
 *  suspensas. Um arquivo guardado teria a lista de instituições do dia em que
 *  foi gerado, e cada nome novo desde então viraria divergência sem motivo.
 *
 *  SÓ APARECE PARA QUEM ADMINISTRA CADASTROS, porque a importação pode criar
 *  instituição e interlocutor em volume — e esconder é conveniência: o servidor
 *  recusa 403 a quem não administra, com ou sem botão na tela.
 */

import { useRef, useState } from 'react';

import { baixarModeloDeImportacao, subirPlanilhaDeAgendas } from '@/api/cliente';
import type { ModeloDePlanilha } from '@/api/cliente';
import { Botao, Cartao, FaixaDeErro, Modal } from '@/componentes/basicos';

/** Os dois modelos, como a pessoa os escolhe.
 *
 *  O PEDIDO: "quando eu clicar em importar a planilha eu quero ter um modal com
 *  opções de fazer o download de dois modelos distintos". A razão é o EVENTO —
 *  54 agendas num mesmo dia são muitas conversas curtas, e as 58 colunas do
 *  completo viram rolagem horizontal para preencher quatro coisas por linha.
 *
 *  CADA UM DIZ PARA QUEM SERVE, e não só o nome: "completo" e "simplificado"
 *  sozinhos fazem a pessoa escolher pelo que soa mais seguro, que é sempre o
 *  primeiro — e ela baixa 58 colunas para registrar um evento. */
const MODELOS: {
  chave: ModeloDePlanilha;
  titulo: string;
  para: string;
  colunas: string;
}[] = [
  {
    chave: 'completo',
    titulo: 'Completo',
    para: 'A agenda que merece registro inteiro: o antes e o depois da reunião, até quatro interlocutores e três materiais.',
    colunas: '58 colunas',
  },
  {
    chave: 'simplificado',
    titulo: 'Simplificado',
    para: 'O evento com muitas conversas curtas — 54 agendas no mesmo dia. Sem os campos de aceite, expectativa e materiais.',
    colunas: '22 colunas',
  },
];

export function BotaoDeImportar({
  podeAdministrar,
  aoSubir,
}: {
  podeAdministrar: boolean;
  /** Chamado com o id da importação depois do upload, para a tela abrir a
   *  conferência.
   *
   *  ELE RECEBE E NÃO NAVEGA, e é a correção de um defeito que a pessoa sentia
   *  assim: subia a planilha, nada acontecia, e a conferência só aparecia se ela
   *  atualizasse a página.
   *
   *  A CAUSA: este componente chamava `useNavegacao()` por conta própria, e o hook
   *  guarda o lugar num `useState` PRÓPRIO de cada chamador. `irPara` empurrava a
   *  URL, atualizava o estado deste botão — que ninguém lê — e o `App`, com a sua
   *  própria instância do hook, nunca sabia que a rota tinha mudado. Todo o resto
   *  da tela recebe `irPara` de cima; este era o único lugar que fugia do padrão. */
  aoSubir: (importacaoId: string) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);

  if (!podeAdministrar) return null;

  const baixar = async (modelo: ModeloDePlanilha) => {
    setOcupado(true);
    setErro(null);
    try {
      const arquivo = await baixarModeloDeImportacao(modelo);
      // O download por link temporário, e não `window.open`: a rota exige
      // cookie de sessão, e abrir numa aba nova perderia o cabeçalho de CSRF
      // no dia em que a rota deixar de ser um GET simples.
      const endereco = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      link.href = endereco;
      link.download = `modelo-de-agendas-${modelo}.xlsx`;
      link.click();
      URL.revokeObjectURL(endereco);
      setEscolhendo(false);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui baixar o modelo.');
    } finally {
      setOcupado(false);
    }
  };

  const subir = async (arquivo: File) => {
    setOcupado(true);
    setErro(null);
    try {
      const importacao = await subirPlanilhaDeAgendas(arquivo);
      // VAI DIRETO PARA A CONFERÊNCIA. Nada foi criado ainda — o upload só
      // propõe —, e mandar a pessoa procurar a conferência depois seria
      // esconder o único passo que falta.
      aoSubir(importacao.id);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não consegui ler a planilha.');
    } finally {
      setOcupado(false);
      // Limpa a seleção para a pessoa poder subir O MESMO arquivo de novo
      // depois de corrigi-lo: sem isto, o `change` não dispara na segunda vez.
      if (entrada.current) entrada.current.value = '';
    }
  };

  return (
    <>
      {erro ? <FaixaDeErro mensagem={erro} /> : null}
      <Botao variante="secundario" desabilitado={ocupado} aoClicar={() => setEscolhendo(true)}>
        Baixar modelo de planilha
      </Botao>
      {escolhendo ? (
        <Modal
          titulo="Qual modelo você quer?"
          subtitulo="Os dois geram a mesma agenda. O simplificado só pede menos colunas."
          aoFechar={() => setEscolhendo(false)}
          largura={640}
        >
          <div className="pilha">
            {MODELOS.map((modelo) => (
              <Cartao key={modelo.chave}>
                <div className="pilha pilha--curta">
                  <div className="linha linha--entre">
                    <strong>{modelo.titulo}</strong>
                    <span className="texto--secundario">{modelo.colunas}</span>
                  </div>
                  <p className="texto--secundario">{modelo.para}</p>
                  <div>
                    <Botao
                      desabilitado={ocupado}
                      aoClicar={() => void baixar(modelo.chave)}
                    >
                      Baixar o {modelo.titulo.toLowerCase()}
                    </Botao>
                  </div>
                </div>
              </Cartao>
            ))}
          </div>
        </Modal>
      ) : null}
      <Botao
        variante="secundario"
        desabilitado={ocupado}
        aoClicar={() => entrada.current?.click()}
      >
        Subir planilha preenchida
      </Botao>
      <input
        ref={entrada}
        type="file"
        accept=".xlsx"
        style={{ display: 'none' }}
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          if (arquivo) void subir(arquivo);
        }}
      />
    </>
  );
}
