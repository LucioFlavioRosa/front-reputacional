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
import { Botao, FaixaDeErro } from '@/componentes/basicos';
import { useNavegacao } from '@/navegacao/useNavegacao';

/** O nome que o arquivo baixado recebe na pasta de downloads. */
const NOME_DO_MODELO = 'modelo-de-agendas.xlsx';

export function BotaoDeImportar({ podeAdministrar }: { podeAdministrar: boolean }) {
  const { irPara } = useNavegacao();
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!podeAdministrar) return null;

  const baixar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      const arquivo = await baixarModeloDeImportacao();
      // O download por link temporário, e não `window.open`: a rota exige
      // cookie de sessão, e abrir numa aba nova perderia o cabeçalho de CSRF
      // no dia em que a rota deixar de ser um GET simples.
      const endereco = URL.createObjectURL(arquivo);
      const link = document.createElement('a');
      link.href = endereco;
      link.download = NOME_DO_MODELO;
      link.click();
      URL.revokeObjectURL(endereco);
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
      irPara({ destino: 'importacao', importacao: importacao.id });
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
      <Botao variante="secundario" desabilitado={ocupado} aoClicar={() => void baixar()}>
        Baixar modelo de planilha
      </Botao>
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
