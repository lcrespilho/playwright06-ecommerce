# playwright06-ecommerce

Este projeto possui um código para que bots playwright naveguem no meu ecommerce teste em https://louren.co.in/ecommerce/home.html.

Os bots rodam numa VM GCP em us-central1-a.

Para rodar o projeto: `npm run test`
O arquivo `ecosystem.config.js` configura o PM2 automaticamente, ou seja, `pm2 start ecosystem.config.js` (rodado na VM) cria uma entrada monitorada para executar o serviço.

Para ver o conteúdo dos cookies dos bots: `npm run fetchDb`. Isso fará o download do arquivo ./allCookies.json contendo todos os cookies.

Para deletar os cookies: `firebase database:remove /ecommerce0X --project lourenco-tests-340212`
