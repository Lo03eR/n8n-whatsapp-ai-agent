FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.js certificate.mjs certificate-blank.pdf ./
COPY fonts ./fonts
CMD ["node", "index.js"]
