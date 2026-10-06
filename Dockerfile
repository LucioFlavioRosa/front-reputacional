# =============================================================================
# Painel Reputacional — web
#
# O front é estático: `vite build` produz HTML, CSS e JS, e um servidor os
# entrega. Não há Node em produção — a imagem final é nginx com uns 350 KB de
# bundle dentro.
#
# UMA IMAGEM PARA TODOS OS AMBIENTES, e é o que permite promover para o cliente
# o MESMO digest que se testou aqui. Duas decisões sustentam isso:
#
#   a API na MESMA ORIGEM   `VITE_API_URL` é vazio por padrão, então o bundle
#                           chama `/api/...` e o nginx desta imagem encaminha
#                           para `API_UPSTREAM` — variável de EXECUÇÃO.
#   telemetria em RUNTIME   a connection string do Application Insights chega
#                           por variável de ambiente e é escrita em
#                           `/configuracao.js` na subida, junto da parte da CSP
#                           que depende dela.
#
# `VITE_API_URL` CONTINUA EXISTINDO para o caso de alguém apontar o bundle para
# uma API de outra origem (sem o proxy desta imagem). Aí volta a valer o que o
# Vite impõe: `import.meta.env` é substituído em tempo de compilação, e trocar o
# endereço exige reconstruir. É a exceção, não o caminho.
# =============================================================================

FROM node:22-alpine AS construcao

WORKDIR /construcao
COPY package*.json ./
# `npm ci` e não `install`: respeita o lockfile exatamente, então a imagem de
# hoje é a mesma de amanhã.
RUN npm ci

COPY . .

# VAZIO DE PROPÓSITO: `BASE` fica vazio no bundle, as chamadas saem como
# `/api/...` e quem encaminha é o nginx desta imagem, por `API_UPSTREAM`. É o que
# torna a imagem neutra de ambiente.
#
# Preenchê-lo só faz sentido para um bundle que fale com uma API de OUTRA origem,
# sem o proxy daqui — e aí a imagem passa a ser de um ambiente só.
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

# `npm run build`, e nunca `vite build` direto: o script roda `tsc -b` ANTES,
# então erro de tipo derruba a imagem em vez de virar defeito em produção.
# `vite build` sozinho não faz typecheck nenhum.
RUN npm run build


FROM nginx:1.27-alpine AS servidor

COPY --from=construcao /construcao/dist /usr/share/nginx/html
# EM `templates/`, E NÃO EM `conf.d/`: a imagem oficial do nginx roda o
# `envsubst` sobre tudo o que estiver aqui na hora de subir, e é assim que
# `${API_UPSTREAM}` — o endereço interno do back, que só existe em tempo de
# execução — entra na configuração.
COPY nginx.conf /etc/nginx/templates/default.conf.template

# SÓ `API_UPSTREAM` É SUBSTITUÍDO. Sem o filtro, o `envsubst` trocaria também
# `$host`, `$uri` e `$proxy_add_x_forwarded_for` por vazio caso existisse
# variável de ambiente com esse nome — e a configuração encaminharia para lugar
# nenhum, sem erro no build.
ENV NGINX_ENVSUBST_FILTER=^(API_UPSTREAM|CSP_CONNECT_EXTRA)$

# O PADRÃO É O DA PILHA LOCAL, onde a API é o serviço `api` do compose. Sem um
# valor, o `envsubst` deixaria `${API_UPSTREAM}` literal e o nginx recusaria
# subir — a imagem tem de funcionar fora do Azure também.
ENV API_UPSTREAM=http://api:8000

# VARIÁVEL VAZIA NÃO É VARIÁVEL AUSENTE, e o `ENV` acima só cobre a segunda.
# Com `API_UPSTREAM=` explícito — um valor que o Terraform pode injetar por
# engano — o `envsubst` produz `proxy_pass ;` e o nginx morre no arranque com
# "invalid number of arguments", que não diz nada sobre a causa.
#
# Recusar é certo; recusar DIZENDO O QUE FALTA é o que separa dez minutos de
# investigação de dez segundos. O script roda antes do `20-envsubst-…` da
# imagem oficial, e o entrypoint dela aborta quando um deles falha.
RUN printf '#!/bin/sh\nif [ -z "$API_UPSTREAM" ]; then\n  echo "API_UPSTREAM esta vazio: o nginx nao tem para onde encaminhar /api." >&2\n  echo "Defina o endereco interno do back, como http://ca-back-xxx.internal.<regiao>.azurecontainerapps.io" >&2\n  exit 1\nfi\n# O nginx resolve o nome do upstream NO ARRANQUE. Nome que nao resolve mata\n# o conteiner com "host not found in upstream", que nao diz onde procurar.\nalvo=$(echo "$API_UPSTREAM" | sed -e "s|^[a-z]*://||" -e "s|[:/].*$||")\nif ! getent hosts "$alvo" >/dev/null 2>&1; then\n  echo "API_UPSTREAM aponta para \"$alvo\", que nao resolve deste conteiner." >&2\n  echo "Confira o nome, e se o front esta na mesma rede do back." >&2\n  exit 1\nfi\n' > /docker-entrypoint.d/15-conferir-api-upstream.sh \
 && chmod +x /docker-entrypoint.d/15-conferir-api-upstream.sh

# A CSP tem de permitir EXATAMENTE o endereço para o qual o bundle foi
# compilado. `ARG` não atravessa estágio, então ele é redeclarado aqui.
#
# É o MESMO fato do `VITE_API_URL` acima. Escrito em dois lugares, ele se
# desencontra — e o sintoma seria a tela vazia sem erro no servidor.
#
# VAZIO NO CAMINHO NORMAL, e aí `'self'` basta sozinho: o bundle chama `/api`
# aqui mesmo. A parte da CSP que depende da TELEMETRIA é de execução, e entra por
# `${CSP_CONNECT_EXTRA}` — ver o script de subida mais abaixo.
#
# O `grep` depois do `sed` não é zelo excessivo: marcador não substituído vira
# uma CSP com um nome de host inválido, o navegador bloqueia TODA chamada, e a
# tela fica vazia sem erro nenhum no servidor. Falhar no build é bem mais barato.
ARG VITE_API_URL=

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

RUN sed -i "s|__CONNECT_SRC__|'self' ${VITE_API_URL}|g" /etc/nginx/templates/default.conf.template \
 && case "$HSTS" in \
        on)          IDADE=31536000 ;; \
        ""|off)      IDADE= ;; \
        *[!0-9]*)    echo "HSTS: use off, on, ou um max-age em segundos (veio '$HSTS')"; exit 1 ;; \
        *)           IDADE="$HSTS" ;; \
    esac; \
    if [ -n "$IDADE" ]; then \
        sed -i "s|__HSTS__|add_header Strict-Transport-Security \"max-age=${IDADE}; includeSubDomains\" always;|g" /etc/nginx/templates/default.conf.template; \
    else \
        sed -i '/__HSTS__/d' /etc/nginx/templates/default.conf.template; \
    fi \
 && if grep -qE "__CONNECT_SRC__|__HSTS__" /etc/nginx/templates/default.conf.template; then \
        echo "nginx.conf: marcador nao substituido"; exit 1; \
    fi \
 && API_UPSTREAM=http://127.0.0.1:8000 CSP_CONNECT_EXTRA= \
    envsubst '${API_UPSTREAM} ${CSP_CONNECT_EXTRA}' < /etc/nginx/templates/default.conf.template \
    > /etc/nginx/conf.d/default.conf \
 && nginx -t \
 && rm /etc/nginx/conf.d/default.conf

# A CONFIGURAÇÃO DO NAVEGADOR, escrita na subida — ver o próprio script, que
# explica por que é `.envsh` e por que a CSP sai de lá junto.
COPY docker/16-configuracao-do-navegador.envsh /docker-entrypoint.d/
RUN chmod +x /docker-entrypoint.d/16-configuracao-do-navegador.envsh

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
