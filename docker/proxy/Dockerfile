FROM nginx:latest

RUN mkdir /etc/nginx/ssl

COPY ./_.evl.uic.edu.crt /etc/nginx/ssl/evl.crt
COPY ./_.evl.uic.edu.key /etc/nginx/ssl/evl.key
COPY ./https-forwarding.conf /etc/nginx/conf.d/https-forwarding.conf

RUN service nginx restart