# playwright06-ecommerce

Este projeto possui um código para que bots playwright naveguem no meu ecommerce teste em https://louren.co.in/ecommerce/home.html.

Os bots rodam numa VM GCP em us-central1-a.

Para rodar o projeto: `npx ts-node src/index.ts` ou `npm run test`

Para ver o conteúdo dos cookies dos bots: `npx ts-node src/fetchDb.ts` ou `npm run fetchDb`. Isso fará o download do arquivo ./allCookies.json contendo todos os cookies.
