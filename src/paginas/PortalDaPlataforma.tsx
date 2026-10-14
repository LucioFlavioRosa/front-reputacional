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

import { GerenciamentoDePerfis } from '@/paginas/GerenciamentoDePerfis';

/** `Acessos` saiu daqui, e a tela nova a substitui inteira.
 *
 *  A antiga mostrava o acesso como ele é GUARDADO — um `select` com onze papéis
 *  de nome técnico, mais caixas para irrestrito, externo, frentes e unidades.
 *  A nova mostra as três camadas que quem libera uma pessoa de fato usa, e
 *  ABSORVEU prazo, externo e escopo num quarto bloco: deixá-los sem tela os
 *  devolveria ao `UPDATE` manual no banco, que é o que a tela antiga existia
 *  para evitar.
 *
 *  O `Secao` de "Plataforma" saiu junto: com uma aba só, dois títulos
 *  encadeados ("Plataforma" e depois "Gerenciamento de perfis") só empurravam o
 *  conteúdo para baixo. Volta no dia em que o portal tiver companhia — política
 *  de sessão, integrações, telemetria —, que é a razão de ele existir.
 */
export function PortalDaPlataforma({
  euId,
  mercadoLancado = false,
}: {
  euId: string | null;
  mercadoLancado?: boolean;
}) {
  return <GerenciamentoDePerfis euId={euId} mercadoLancado={mercadoLancado} />;
}
