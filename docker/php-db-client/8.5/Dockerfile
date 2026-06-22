FROM php:8.5-cli@sha256:1954ff5cd21f222c992b79d25e403b2600cec829678d5bb7076883f3a44c0d6e

LABEL org.opencontainers.image.title="wordpresshx PHP 8.5 DB client"
LABEL org.opencontainers.image.description="Pinned PHP CLI runtime with mysqli and pdo_mysql for wordpresshx live DB gates"
LABEL org.opencontainers.image.source="wordpresshx"
LABEL wordpresshx.issue="WPHX-305.09"

RUN docker-php-ext-install mysqli pdo_mysql
