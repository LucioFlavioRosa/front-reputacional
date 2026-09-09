/** Dois campos que o formulário repete dezenas de vezes.
 *
 *  Ficam FORA de `Cadastro.tsx`: são auto-contidos, e a tela do formulário
 *  já é longa o bastante sem eles.
 */

import { Campo, estiloDeEntrada } from '@/componentes/basicos';
import { CampoQueCompleta } from '@/componentes/CampoQueCompleta';

export function CampoDeTexto({
  rotulo,
  valor,
  aoMudar,
  tipo = 'text',
  dica,
}: {
  rotulo: string;
  valor: string | undefined;
  aoMudar: (valor: string) => void;
  tipo?: string;
  dica?: string;
}) {
  return (
    <Campo rotulo={rotulo} dica={dica}>
      <input
        type={tipo}
        style={estiloDeEntrada}
        value={valor ?? ''}
        onChange={(evento) => aoMudar(evento.target.value)}
      />
    </Campo>
  );
}

export function CampoDeDicionario({
  rotulo,
  itens,
  valor,
  aoMudar,
}: {
  rotulo: string;
  itens: { codigo: string; nome: string }[];
  valor: string | undefined;
  aoMudar: (valor: string) => void;
}) {
  return (
    <CampoQueCompleta
      rotulo={rotulo}
      valor={valor ?? ''}
      aoEscolher={aoMudar}
      opcoes={itens.map((item) => ({ valor: item.codigo, rotulo: item.nome }))}
    />
  );
}

/** Em que aba está o material `indice`, e que número ele tem NA TELA.
 *
 *  `form.materiais` é uma lista só; a tela a parte em duas, por momento. Dizer
 *  "o material 7" quando a aba mostra três linhas manda a pessoa procurar uma
 *  linha que não existe ali — e agora nem na aba em que ela está.
 */
