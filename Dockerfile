FROM oven/bun:1.2.20-alpine

ARG ugid

ENV UGID=${ugid:-0}

RUN if [ $UGID != 0 ] && [ $UGID != 1000 ]; then addgroup -g $UGID musalup; fi
RUN if [ $UGID != 0 ] && [ $UGID != 1000 ]; then adduser -u $UGID -D musalup -G musalup; fi

WORKDIR /home/musalup

COPY dist .
COPY .env .env
COPY public public

RUN chown -R $UGID:$UGID /home/musalup

USER $UGID:$UGID

EXPOSE 3000/tcp

ENV NODE_ENV=production

CMD ["bun", "run", "index.js"]
