/* A configuração do navegador, lida na subida do CONTÊINER — não no build.
 *
 * ESTE ARQUIVO É O PADRÃO DE DESENVOLVIMENTO: o `vite` o serve como está, e a
 * imagem o REESCREVE quando o contêiner sobe (ver `/docker-entrypoint.d/` no
 * `Dockerfile`). Em desenvolvimento, portanto, a telemetria fica desligada — que
 * é o comportamento que já existia.
 *
 * POR QUE ELE EXISTE: o Vite substitui `import.meta.env` em tempo de COMPILAÇÃO,
 * então a connection string do Application Insights ficava assada na imagem. Com
 * um cliente usando o App Insights dele, isso obrigava a um build por ambiente —
 * e aí a imagem que se testou não é a que se publica. Aqui o mesmo digest serve
 * dev, homologação e o cluster do cliente, mudando só a variável de ambiente.
 *
 * `<script>` COMUM, E NÃO UM `fetch`: ele é carregado antes do bundle, então
 * `iniciarTelemetria()` já encontra o valor de forma SÍNCRONA — e o erro no
 * primeiro render, que é o motivo de a telemetria existir, continua sendo
 * capturado. Um `fetch` abriria uma janela exatamente ali.
 */
window.__PAINEL__ = {
  /** Connection string do Application Insights. Vazia = telemetria desligada. */
  appInsights: '',
};
