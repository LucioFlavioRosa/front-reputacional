/** Onde o botão "PNG" aparece: só nas telas Visão geral, Painel e Lentes, por
 *  pedido — nas outras (formulários, cadastros, listas, metodologia…) o
 *  botão não faz sentido.
 *
 *  DESLIGADO POR PADRÃO, e ligado por quem MOSTRA gráficos: assim uma tela
 *  nova nasce sem o botão, e não o contrário. O próprio `BaixarPng` consulta
 *  este contexto, então `Secao` e os cartões do drill nem precisam saber.
 */

import { createContext } from 'react';

export const ContextoDoPng = createContext(false);
