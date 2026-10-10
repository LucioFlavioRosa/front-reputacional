/** Quando um link do drill deve navegar POR DENTRO da página.
 *
 *  OS LINKS DO DRILL TÊM `href` REAL (o hash do nível, A3), e não `#`: é o que
 *  deixa abrir um nível em nova aba e copiar o endereço. O `onClick` só toma
 *  o lugar do navegador no clique simples (botão principal, sem tecla
 *  modificadora); com Ctrl, Cmd, Shift, Alt ou botão do meio, o navegador
 *  segue o `href` e abre a aba ou a janela como de costume.
 */

interface CliqueDoMouse {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

export function ehCliqueSimples(evento: CliqueDoMouse): boolean {
  return (
    !evento.defaultPrevented &&
    evento.button === 0 &&
    !evento.metaKey &&
    !evento.ctrlKey &&
    !evento.shiftKey &&
    !evento.altKey
  );
}
