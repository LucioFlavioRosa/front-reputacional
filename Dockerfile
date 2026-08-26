# =============================================================================
# Painel Reputacional — web
#
# O front é estático: `vite build` produz HTML, CSS e JS, e um servidor os
# entrega. Não há Node em produção — a imagem final é nginx com uns 350 KB de
# bundle dentro.
#
# `VITE_API_URL` entra no BUILD, não na execução.
#
# É a consequência de `import.meta.env` do Vite ser substituído em tempo de
# compilação. Trocar o endereço da API exige reconstruir a imagem — não dá para
# passar variável de ambiente no `docker run` e esperar efeito. A mesma
# propriedade é o que permite eliminar código morto por build, e é deliberada.
# =============================================================================

FROM node:22-alpine AS construcao

WORKDIR /construcao
COPY package*.json ./
# `npm ci` e não `install`: respeita o lockfile exatamente, então a imagem de
# hoje é a mesma de amanhã.
RUN npm ci

COPY . .

ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

# A telemetria do navegador também é decidida no build, pelo mesmo motivo: o
# Vite substitui `import.meta.env` na compilação. Sem este ARG a imagem saía com
# a telemetria DESLIGADA em qualquer ambiente, e nada denunciava — o código a
# desliga silenciosamente quando a connection string falta, que é o
# comportamento certo para desenvolver, e o errado para produção sem aviso.
ARG VITE_APPINSIGHTS_CONNECTION_STRING=
ENV VITE_APPINSIGHTS_CONNECTION_STRING=$VITE_APPINSIGHTS_CONNECTION_STRING

# `npm run build`, e nunca `vite build` direto: o script roda `tsc -b` ANTES,
# então erro de tipo derruba a imagem em vez de virar defeito em produção.
# `vite build` sozinho não faz typecheck nenhum.
RUN npm run build


FROM nginx:1.27-alpine AS servidor

COPY --from=construcao /construcao/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# A CSP tem de permitir EXATAMENTE o endereço para o qual o bundle foi
# compilado. `ARG` não atravessa estágio, então ele é redeclarado aqui.
#
# É o MESMO fato do `VITE_API_URL` acima. Escrito em dois lugares, ele se
# desencontra — e o sintoma seria a tela vazia sem erro no servidor.
#
# `'self'` fica sempre: o painel busca os próprios arquivos, e quando a API é
# servida na mesma origem (o caso atrás do Front Door) ele já basta sozinho.
#
# O `grep` depois do `sed` não é zelo excessivo: marcador não substituído vira
# uma CSP com um nome de host inválido, o navegador bloqueia TODA chamada, e a
# tela fica vazia sem erro nenhum no servidor. Falhar no build é bem mais barato.
ARG VITE_API_URL=http://localhost:8000

# A MESMA connection string do estágio de build, e não um segundo argumento com
# os endereços.
#
# O SDK do Application Insights manda telemetria para o `IngestionEndpoint` e
# para o `LiveEndpoint`, os dois escritos DENTRO da connection string. Origem
# fora do `connect-src` é bloqueada pelo navegador, e a telemetria sumiria sem
# erro no servidor — justamente o tipo de falha que ela existiria para mostrar.
#
# Os endereços NÃO são um argumento separado: seriam um segundo lugar para o
# mesmo fato. Aqui eles são EXTRAÍDOS da connection string.
ARG VITE_APPINSIGHTS_CONNECTION_STRING=

# HSTS: `off` (padrão), `on`, ou um `max-age` em segundos.
#
# Aceitar o número não é enfeite: HSTS não se desfaz do lado do servidor. Depois
# que o navegador guarda o registro, ele recusa http naquele host pelo prazo
# inteiro, e retirar o cabeçalho não cancela nada — só para de renovar. Com um
# ano de cara, um erro de certificado na primeira semana deixa gente sem acesso
# por doze meses.
#
# A ordem sensata é rampa: `HSTS=300` na primeira implantação, confirmar que o
# HTTPS está sólido, e então `HSTS=on`.
#
# `on` = 31536000 (um ano), que é o valor de regime.
#
# `off` em qualquer lugar cujo certificado o navegador não aceite — a pilha
# local usa autoassinado. A explicação longa está no `nginx.conf`.
ARG HSTS=off

RUN TELEMETRIA=""; \
    for chave in IngestionEndpoint LiveEndpoint; do \
        valor=$(printf '%s' "$VITE_APPINSIGHTS_CONNECTION_STRING" | tr ';' '\n' \
                | sed -n "s|^${chave}=||p" | head -n1); \
        if [ -n "$valor" ]; then TELEMETRIA="$TELEMETRIA ${valor%/}"; fi; \
    done; \
    if [ -n "$VITE_APPINSIGHTS_CONNECTION_STRING" ] && [ -z "$TELEMETRIA" ]; then \
        echo "CSP: connection string sem IngestionEndpoint/LiveEndpoint"; exit 1; \
    fi; \
    echo "connect-src extra: '$TELEMETRIA'" \
 && sed -i "s|__CONNECT_SRC__|'self' ${VITE_API_URL}${TELEMETRIA}|g" /etc/nginx/conf.d/default.conf \
 && case "$HSTS" in \
        on)          IDADE=31536000 ;; \
        ""|off)      IDADE= ;; \
        *[!0-9]*)    echo "HSTS: use off, on, ou um max-age em segundos (veio '$HSTS')"; exit 1 ;; \
        *)           IDADE="$HSTS" ;; \
    esac; \
    if [ -n "$IDADE" ]; then \
        sed -i "s|__HSTS__|add_header Strict-Transport-Security \"max-age=${IDADE}; includeSubDomains\" always;|g" /etc/nginx/conf.d/default.conf; \
    else \
        sed -i '/__HSTS__/d' /etc/nginx/conf.d/default.conf; \
    fi \
 && if grep -qE "__CONNECT_SRC__|__HSTS__" /etc/nginx/conf.d/default.conf; then \
        echo "nginx.conf: marcador nao substituido"; exit 1; \
    fi \
 && nginx -t

EXPOSE 80

# `127.0.0.1`, e NÃO `localhost`.
#
# O `wget` do BusyBox resolve `localhost` para `::1` e desiste ali; o nginx
# escuta só em IPv4 (`listen 80;`). Com `localhost`, o contêiner fica
# `unhealthy` para sempre — e sem consequência visível, porque a borda fala com
# `web:80` por IPv4 e a página carrega normalmente. Healthcheck quebrado em
# silêncio é pior do que healthcheck nenhum: ele deixa de avisar de tudo.
#
# O `curl` do healthcheck da API não sofre disso: tenta `::1`, falha, e VOLTA
# para IPv4.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
