# Etapa 1: Construcción del backend
FROM node:20-alpine AS backend-builder

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# Instalar nest cli
RUN npm i -g @nestjs/cli

# Copiar los archivos package.json y package-lock.json al contenedor
COPY package*.json ./

# Instalar las dependencias (incluyendo dependencias de desarrollo)
RUN npm install

# Copiar el resto del código de la aplicación al contenedor
COPY . .

# Construir la aplicación para producción
RUN npm run build


# Etapa 2: Construcción del frontend
FROM node:20-alpine AS frontend-builder

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /client

# Instalar Quasar CLI globalmente
RUN npm install -g @quasar/cli

# Copiar todo el proyecto frontend primero
COPY client ./

# Instalar las dependencias del frontend
RUN npm install

# Construir la aplicación frontend para producción
RUN quasar build

# Etapa 3: Imagen final
FROM node:20-alpine

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# Argumento para el puerto (se pasará en tiempo de construcción)
ARG PORT=3000

# Establecer la variable de entorno para el puerto
ENV PORT=${PORT}

# Copiar solo las dependencias de producción del backend desde la etapa de construcción
COPY --from=backend-builder /app/package*.json ./
RUN npm install --production

# Copiar el directorio de construcción del backend desde la etapa de construcción
COPY --from=backend-builder /app/dist ./dist

# Copiar el directorio de construcción del frontend desde la etapa de construcción
COPY --from=frontend-builder /client/dist/spa /client/dist/spa

# Exponer el puerto (informativo, no dinámico)
EXPOSE ${PORT}

# Comando para ejecutar la aplicación
CMD ["node", "dist/main"]