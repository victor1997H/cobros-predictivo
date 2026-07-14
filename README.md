# Sistema de Gestión de Cobros Predictivo

## Proyecto Final – Despliegue de una Aplicación en un VPS

---

# Descripción

El **Sistema de Gestión de Cobros Predictivo** es una aplicación web desarrollada para administrar procesos de cobro mediante una arquitectura basada en contenedores Docker.

La solución integra un **Frontend desarrollado en Angular**, un **Backend construido con NestJS** y una **Base de Datos PostgreSQL**. Todo el sistema se encuentra desplegado en un Servidor VPS utilizando **Docker Compose**, **Traefik** como Reverse Proxy y **GitHub Actions** para automatizar el proceso de Integración y Despliegue Continuo (CI/CD).

---

# Arquitectura de la Solución

```
                     GitHub
                        │
                GitHub Actions
                        │
          Build + Publicación en GHCR
                        │
                        ▼
          GitHub Container Registry
                        │
                        ▼
                 VPS (Contabo)
                        │
                 Docker Compose
                        │
       ┌────────────────┼─────────────────┐
       │                │                 │
    Traefik        Portainer         PostgreSQL
       │                                  │
       │                               pgAdmin
       │
 ┌─────┴────────────┐
 │                  │
Frontend Angular   Backend NestJS
        │              │
        └──── API REST ───► PostgreSQL
```

---

# Tecnologías Utilizadas

## Frontend

- Angular
- TypeScript
- SCSS
- Nginx

## Backend

- NestJS
- TypeScript
- TypeORM

## Base de Datos

- PostgreSQL 17

## Infraestructura

- Docker
- Docker Compose
- Traefik
- Portainer
- pgAdmin

## DevOps

- GitHub
- GitHub Actions
- GitHub Container Registry (GHCR)

---

# Estructura del Proyecto

```
cobros-predictivo
│
├── .github
│   └── workflows
│       └── deploy.yml
│
├── backend
│
├── frontend
│
├── docker
│
├── docs
│
├── docker-compose.yml
│
├── .env.example
│
└── README.md
```

---

# Servicios Desplegados

| Servicio | Estado |
|----------|:------:|
| Frontend Angular | ✅ |
| Backend NestJS | ✅ |
| PostgreSQL | ✅ |
| pgAdmin | ✅ |
| Portainer | ✅ |
| Traefik | ✅ |

---

# Servicios Publicados

| Servicio | URL |
|----------|-----|
| Aplicación | https://sistemacobros.byronrm.com |
| Backend | https://backsistemacobros.byronrm.com |
| pgAdmin | https://pgsistemacobros.byronrm.com |
| Portainer | https://portainersistemacobros.byronrm.com |

---

# Docker

Cada componente del proyecto fue desplegado en su propio contenedor Docker.

Servicios implementados:

- Frontend
- Backend
- PostgreSQL
- pgAdmin

Todos los servicios se comunican mediante redes Docker privadas administradas por Docker Compose.

---

# Traefik

Traefik fue configurado como Reverse Proxy para administrar el acceso a todos los servicios mediante subdominios.

Funciones implementadas:

- Publicación mediante subdominios.
- Certificados SSL automáticos.
- Enrutamiento de servicios.
- Comunicación HTTPS.

---

# Base de Datos

Se utilizó PostgreSQL como motor de base de datos.

Características implementadas:

- Persistencia mediante volúmenes Docker.
- Administración mediante pgAdmin.
- Comunicación con el Backend utilizando Docker Network.

---

# Integración y Despliegue Continuo (CI/CD)

El proyecto implementa un flujo completo de Integración y Despliegue Continuo utilizando GitHub Actions.

## Flujo de trabajo

1. Se realiza un **Push** a la rama **main**.
2. GitHub Actions inicia automáticamente.
3. Se construye la imagen Docker del Backend.
4. Se construye la imagen Docker del Frontend.
5. Ambas imágenes se publican en GitHub Container Registry.
6. GitHub Actions establece una conexión SSH con el VPS.
7. El VPS descarga las nuevas imágenes.
8. Docker Compose actualiza automáticamente los servicios.
9. Se verifica el correcto funcionamiento del despliegue.

---

# GitHub Container Registry (GHCR)

Imágenes publicadas:

- ghcr.io/victor1997h/cobros-predictivo-backend
- ghcr.io/victor1997h/cobros-predictivo-frontend

---

# Funcionalidades Implementadas

- Registro de usuarios.
- Inicio de sesión.
- Persistencia de datos en PostgreSQL.
- Comunicación Frontend – Backend.
- API REST.
- Docker Compose.
- Traefik.
- Portainer.
- pgAdmin.
- HTTPS.
- GitHub Actions.
- CI/CD.
- Publicación de imágenes en GitHub Container Registry.

---

# Evidencias

Durante la presentación del proyecto se demostrará el funcionamiento de:

- Aplicación Web.
- Backend.
- Registro de usuarios.
- Persistencia de datos.
- PostgreSQL.
- pgAdmin.
- Portainer.
- GitHub Actions.
- GitHub Packages (GHCR).

---

# Integrantes

- **Víctor Hualpa **
- **Jhon Sotomayor**

---

# Conclusiones

Se implementó una arquitectura moderna basada en contenedores Docker utilizando un Servidor VPS.

La solución integra Frontend, Backend y Base de Datos mediante Docker Compose, Traefik como Reverse Proxy y Portainer para la administración de los servicios.

Además, se implementó un proceso completo de Integración y Despliegue Continuo (CI/CD) utilizando GitHub Actions y GitHub Container Registry (GHCR), automatizando completamente el despliegue de la aplicación.

---

# Repositorio

https://github.com/victor1997H/cobros-predictivo