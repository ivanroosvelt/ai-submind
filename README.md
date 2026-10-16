# submind

`ai-submind` es un gestor local de diagramas de conocimiento (diagramas de clases y de secuencia en el primer
alcance) que vive en `knowledge/` del proyecto anfitrión, versionado con Git como única fuente de verdad. Los
agentes de IA lo consultan y modifican por MCP; las personas lo exploran en una UI web. Contexto completo en
[docs/system/context.md](docs/system/context.md).

## Estado

Estructura base terminada ([PLAN-002](docs/plans/archive/PLAN-002-gestor-diagramas-base.md), cerrado el 2026-10-16):

- Implementado: formato de conocimiento 1.0 y su validación ([spec/format/](spec/format/README.md)), motor
  embebido, consultas y búsqueda léxica, CLI con daemon por proyecto, servidor MCP, UI web (JointJS) para
  diagramas de clases y de secuencia e integridad con Git (diagnóstico tras un merge, sin reparación automática:
  [FEAT-008](docs/system/features/FEAT-008-git-integrity.md)).
- Pendiente: publicación en npm y licencia propia. El paquete aún es `private` y declara
  `"license": "UNLICENSED"` (no hay archivo `LICENSE`; la licencia está por decidir y bloquea la publicación).
  `npx ai-submind` solo funciona con el paquete instalado localmente desde un tarball.

## Requisitos

- Node.js `^22.13.0 || ^24.0.0 || >=26.0.0` y npm.
- Git (la raíz del proyecto es la raíz Git del directorio actual).
- Python ≥ 3.10 solo para los scripts del entorno de desarrollo (`scripts/`).

## Instalación desde el repositorio

```sh
npm ci
npm run build    # vacía dist/ y ejecuta tsc + vite build: binario dist/cli/main.js y la UI en dist/ui/
```

## Instalación en un proyecto (tarball local)

```sh
npm pack                                   # en este repositorio, tras npm run build: ai-submind-0.0.0.tgz
npm install /ruta/a/ai-submind-0.0.0.tgz   # en el proyecto anfitrión
npx ai-submind init
npx ai-submind                             # equivale a serve
```

El tarball incluye `dist/` (sin los mapas de fuente `*.map`), `spec/format/README.md` y `spec/format/schema/`.

## Uso de la CLI

```sh
npx ai-submind <comando> [opciones]   # o, desde este repositorio: node dist/cli/main.js <comando>
```

| Comando | Qué hace | Opciones |
|---------|----------|----------|
| `serve` (por defecto) | Arranca el daemon del proyecto (HTTP en 127.0.0.1:7777 o un puerto libre, con token) | `--knowledge <dir>`, `--port <n>`, `--idle <minutos>` |
| `status` | Muestra el estado del daemon | `--knowledge <dir>` |
| `stop` | Detiene el daemon | `--knowledge <dir>` |
| `init` | Crea `knowledge/` con su manifiesto `ai-submind.json` | `--knowledge <dir>` |
| `validate` | Valida `knowledge/`, incluidos conflictos de merge, IDs duplicados y referencias rotas (código de salida 1 si hay errores) | `--knowledge <dir>` |
| `mcp` | Servidor MCP por stdio para agentes, conectado al daemon (lo arranca si hace falta) | `--knowledge <dir>` |

`--knowledge` es relativo al directorio actual y debe quedar dentro de la raíz del proyecto; por defecto,
`<raíz>/knowledge`. Ayuda: `npx ai-submind --help`. Contrato: [API-003](docs/system/interfaces/API-003-ai-submind-cli.md).

## UI web

`serve` imprime la URL del daemon con su token (`http://127.0.0.1:<puerto>/?token=…`); al abrirla en el
navegador se carga la UI: árbol de modelos y diagramas, diagramas de clases (zoom, ajuste a pantalla,
selección con detalle, hallazgos de validación y refresco en vivo). Solo escribe el layout (posiciones de
nodos y vértices de enlaces): al soltar un nodo o mover un vértice, y con el botón «Auto-layout», que recalcula
el diagrama completo igual que la tool MCP `auto_layout_diagram` (útil para arreglar solapes heredados). Un
`width`/`height` explícito en el layout es un tamaño mínimo: el contenido nunca se recorta.

Los diagramas de secuencia muestran lifelines, activaciones, mensajes (síncronos, asíncronos, respuesta,
creación, destrucción, lost/found), fragmentos combinados con operandos y guardas, e interaction use («ref»).
Las lifelines se arrastran solo en horizontal (su orden es el de x) y su longitud se cambia con el tirador del
extremo inferior; «Auto-layout» también funciona aquí. Las referencias del detalle abren un diagrama que
muestra el destino, y el doble clic en un interaction use abre el diagrama de la interacción usada.

El build de la UI genera `dist/ui/THIRD-PARTY-LICENSES.md` con las licencias del código de terceros
empaquetado (`@joint/core`, MPL-2.0; `@dagrejs/dagre`, MIT); `dist/ui/index.html` indica dónde obtener la forma
fuente de `@joint/core` (https://github.com/clientIO/joint y el paquete npm `@joint/core`).

API HTTP de la UI en [API-002](docs/system/interfaces/API-002-ui-http-api.md); decisiones en
[DEC-017](docs/system/decisions/DEC-017-ui-stack-sse-and-shared-layout.md) y
[DEC-018](docs/system/decisions/DEC-018-sequence-executions-and-layout.md).

## Servidor MCP

Configuración para un cliente MCP por stdio (`.mcp.json` del proyecto anfitrión, con el paquete instalado; el
cliente debe lanzarlo con el directorio de trabajo dentro del proyecto). El servidor se conecta al daemon y lo
arranca si falta:

```json
{
  "mcpServers": {
    "ai-submind": {
      "command": "npx",
      "args": ["ai-submind", "mcp"]
    }
  }
}
```

Sin instalar el paquete, usar `"command": "node"` con `"args": ["/ruta/a/submind/dist/cli/main.js", "mcp"]`.

Tools: `list_models`, `list_diagrams`, `get_element`, `find_elements`, `search`, `relations`, `impact`,
`paths`, `validate` (lectura); `create_element`, `update_element`, `delete_element`, `edit_diagram`,
`apply_batch`, `rename`, `auto_layout_diagram` (escritura, todas con `dryRun`; la primera escritura inicializa `knowledge/` si no
existe). Recursos `ai-submind://schema/{name}`, `ai-submind://model/{id}` y `ai-submind://diagram/{id}`.
Entradas, salidas y errores en [API-001](docs/system/interfaces/API-001-ai-submind-mcp-server.md).

## Desarrollo

El repositorio incluye un entorno de desarrollo asistido por IA:

- [AGENTS.md](AGENTS.md) — instrucciones canónicas para cualquier agente (Claude Code, Copilot, …).
- [docs/system/](docs/system/README.md) — modelo estructural del producto (IDs, relaciones, trazabilidad).
- [.ai/](.ai/README.md) — registro de agentes y skills, políticas y decisiones del entorno.

```sh
npm ci
npm run check                 # tipos, lint, formato, dependencias y pruebas (Vitest), incluidas la
                              # auditoría de licencias y el e2e desde el tarball (test/package/, test/e2e/)
scripts/check                 # todas las verificaciones, incluido npm run check (también en CI)
scripts/sysq find <término>   # buscar en el modelo
scripts/regen                 # regenerar índices y adaptadores
```
