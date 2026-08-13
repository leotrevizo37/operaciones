FROM node:24.14.0-alpine AS frontend-build

WORKDIR /workspace/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM maven:3.9.12-eclipse-temurin-17-alpine AS backend-build

WORKDIR /workspace/backend

COPY backend/ ./
COPY --from=frontend-build /workspace/backend/src/main/resources/static ./src/main/resources/static
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17-jre-alpine

RUN addgroup -S duma && adduser -S -G duma duma

WORKDIR /opt/duma

COPY --from=backend-build /workspace/backend/target/*.jar app.jar

USER duma

EXPOSE 8084

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/opt/duma/app.jar"]
