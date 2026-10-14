# Contexto del producto

> Clasificación de cada afirmación: **[verificado]** en código · **[declarado]** en documentación o
> por una persona · **[inferido]** con evidencia parcial · **[desconocido]**.

## Qué se sabe

- Nombre del repositorio: `submind` **[verificado]** (remoto de Git).
- Rama de trabajo `v2` iniciada sin historia y sin relación con otras ramas, por decisión del
  usuario: nuevo proyecto (EDR-002) **[declarado]**.
- No existe código del producto, stack, dependencias ni pruebas **[verificado]** (árbol vacío al
  iniciar el bootstrap, ver `docs/reports/current/`).

## Qué no se sabe (pendiente de definir con el usuario)

- Propósito del producto, usuarios y problema que resuelve **[desconocido]**.
- Actores, requerimientos y alcance del primer incremento **[desconocido]**.
- Stack tecnológico, plataforma de ejecución y despliegue **[desconocido]**.
- Datos que manejará (incluidos datos personales) y requisitos de seguridad **[desconocido]**.
- Integraciones con sistemas externos **[desconocido]**.

## Próximo paso recomendado

Definir el producto con `requirements-analysis` a partir de una descripción del usuario; registrar
la elección de stack como primera DEC y declarar `code_roots` en `schema.yaml`.
