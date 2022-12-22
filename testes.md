# Teste 1 - 11/12/2022 ~ 20:45

Entrada direta + entrada ecommerce02 + conversões de purchase.
A campanha (de sessão) anterior era ecommerce01.

Objetivo: entender o que vem nas dimensões "Session source / medium" e "Source / medium".

Resultado:
  - Session source / medium = ecommerce01 # da sessão anterior; ignora (direct)
  - Source / medium = ecommerce01 > ecommerce02 # ignora (direct); junta a campanha da sessão (herdada) + campanha no meio da sessão


# Teste 2 - 11/12/2022 ~ 22:30

Entrada ecommerce03 + ecommerce04 + conversões de purchase.
A campanha (de sessão) anterior era ecommerce01.

Objetivo: entender o que vem nas dimensões "Session source / medium" e "Source / medium".

Rersultado:
  - Session source / medium = ecommerce03
  - Source / medium = ecommerce01 > ecommerce02 > ecommerce03 > ecommerce04 # surpreendente. Aparentemente ele registra o caminho das outras sessões também.


# Teste 3 - 12/12/2022 ~ 10:12

Entrada ecommerce05 + conversões de purchase.
A campanha (de sessão) anterior era ecommerce03.

Objetivo: entender o que vem nas dimensões "Session source / medium" e "Source / medium"

Resultado:
  - Session source / medium = ecommerce05
  - Source / medium = ecommerce01 > ecommerce02 > ecommerce03 > ecommerce04 > ecommerce05


