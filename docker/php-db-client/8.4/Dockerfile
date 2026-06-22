FROM php:8.4-cli@sha256:966621a53c8e75f062fad4e043ffec507cb793822aee3422110e0127fe53952d

LABEL org.opencontainers.image.title="wordpresshx PHP 8.4 DB client"
LABEL org.opencontainers.image.description="Pinned PHP CLI runtime with mysqli and pdo_mysql for wordpresshx live DB gates"
LABEL org.opencontainers.image.source="wordpresshx"
LABEL wordpresshx.issue="WPHX-305.09"

RUN docker-php-ext-install mysqli pdo_mysql
