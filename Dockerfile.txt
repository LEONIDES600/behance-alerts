FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package*.json ./

RUN npm install
RUN npx playwright install --with-deps chromium

COPY . .

CMD ["node", "index.js"]
