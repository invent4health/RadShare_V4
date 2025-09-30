FROM node:22 AS builder
WORKDIR /app
COPY . .
RUN yarn install
RUN yarn run build

FROM nginx:stable-alpine
RUN sed -i '/index  index.html index.htm;/a \ \ \ \ try_files $uri $uri/ /index.html;' /etc/nginx/conf.d/default.conf
COPY --from=builder /app/platform/app/dist /usr/share/nginx/html
EXPOSE 80

# Run this command
# docker build -t radshareviewer . && docker run -p 3000:80 radshareviewer
