# Política de seguridad

[English](./SECURITY.md) · **Español**

## Versiones soportadas

Docsera es un proyecto joven en desarrollo activo, todavía sin una
política de soporte a largo plazo. Los arreglos de seguridad van a la
última release; no hay backport a versiones anteriores. Usa siempre el
último tag.

## Reportar una vulnerabilidad

Por favor, **no** abras un issue público para una vulnerabilidad de
seguridad. Usa el [reporte privado de vulnerabilidades](../../security/advisories/new)
de GitHub para este repositorio — abre una conversación privada con el
mantenedor y, si el reporte resulta ser una vulnerabilidad real, puede
convertirse directamente en un GitHub Security Advisory y un arreglo
coordinado.

Incluye lo mismo que en un reporte de bug normal — pasos para
reproducirlo, versión/commit afectado e impacto — más cualquier cosa
específica de que sea sensible en seguridad (por ejemplo, si hace falta
una instancia desplegada y accesible desde internet, o basta con acceso
local/self-hosted).

## Alcance

Docsera es self-hosted: en la configuración por defecto, un reporte sobre
*tu propio* despliegue (`ADMIN_TOKEN` mal configurado, un `.env` expuesto,
etc.) no es una vulnerabilidad del proyecto. Los reportes relevantes son
sobre el código en sí — el server, el widget, la CLI o la imagen Docker —
sin importar quién lo esté ejecutando.

La demo pública en [docs.docsera.dev](https://docs.docsera.dev) es un
despliegue real, accesible desde internet; los problemas encontrados ahí
que se reproduzcan contra el código open source entran en alcance.
