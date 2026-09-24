/** As configurações da plataforma inteira — o que não é de área nenhuma.
 *
 *  QUEM ENTRA NA PLATAFORMA NÃO É ASSUNTO DO CRM NEM DO SCORE. Acessos vale
 *  igualmente para os dois, e morava até 24/09/2026 dentro do portal de
 *  cadastros do CRM — ao lado de Temas e Instituições, que são vocabulário de
 *  agenda. A mesma tela respondia a duas perguntas de donos diferentes, e
 *  quem procurava "onde libero uma pessoa" tinha de saber que a resposta
 *  estava num menu chamado Administração, junto de coisas que não tinham nada
 *  a ver.
 *
 *  UMA ABA SÓ, POR ENQUANTO, e o portal existe assim mesmo: o lugar precisa
 *  estar certo antes de ter companhia. O que vier depois — política de sessão,
 *  integrações, telemetria — é da mesma natureza e cai aqui sem discussão.
 *
 *  A aba não é a barreira: o backend exige `administra_acessos` e responde 403
 *  a quem não tem. Esconder é conveniência de tela.
 */

import { Acessos } from '@/paginas/Acessos';
import { Secao } from '@/componentes/basicos';

export function PortalDaPlataforma({ euId }: { euId: string | null }) {
  return (
    <Secao
      titulo="Plataforma"
      subtitulo="O que vale para o painel inteiro, e não para uma área só."
      nivelDoTitulo={1}
    >
      <Acessos euId={euId} />
    </Secao>
  );
}
