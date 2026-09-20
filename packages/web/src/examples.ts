export interface Example {
  id: string;
  title: string;
  source: string;
}

// Mismo contenido que examples/*.flo en la raíz del repo (ver examples/README.md).
export const EXAMPLES: Example[] = [
  {
    id: "flowchart",
    title: "Flowchart",
    source: `// Flujo de compra completo: carrito -> stock -> pasarela de pago -> orden.
// Usa las tres formas de nodo y aristas con y sin etiqueta.
diagram flowchart

inicio(Cliente en el carrito)
checkout[Confirmar compra]
stock{¿Hay stock?}
sinstock[Mostrar "sin stock"]
reservar[Reservar inventario]
crearorden[Crear orden pendiente]
pago[Redirigir a pasarela de pago]
resultado{¿Pago aprobado?}
reintentar{¿Reintentar pago?}
confirmar[Confirmar orden]
email[Enviar email de confirmación]
liberar[Liberar inventario reservado]
exito(Compra exitosa)
cancelada(Orden cancelada)

inicio -> checkout
checkout -> stock
stock -> sinstock : no
stock -> reservar : sí
sinstock -> inicio : volver al carrito

// Los ids pueden referenciarse antes de declararse; el orden no importa
// (ver "liberar", usado más arriba en "reintentar -> liberar").
reservar -> crearorden
crearorden -> pago
pago -> resultado

resultado -> confirmar : aprobado
resultado -> reintentar : rechazado
reintentar -> pago : sí
reintentar -> liberar : no
liberar -> cancelada

confirmar -> email
email -> exito
`,
  },
  {
    id: "sequence",
    title: "Secuencia",
    source: `// El mismo flujo de compra que 01-flowchart.flo, pero como secuencia:
// frontend, backend, pasarela de pago y el webhook async de confirmación.
diagram sequence

participant cliente as Cliente
participant web as Web
participant api as Backend
participant gw as Pasarela de pago
participant db as Base de datos

cliente -> web : Click "Comprar"
web -> api : POST /checkout
api -> db : SELECT stock
db -> api : stock disponible
api -> db : INSERT orden (pendiente)
api -> gw : POST /charges
gw -> api : 201 Created (redirect_url)
api -> web : 200 OK (redirect_url)
web -> cliente : Redirige a la pasarela
cliente -> gw : Completa datos de la tarjeta

// El webhook llega en su propia request, fuera del flujo síncrono
// anterior — la pasarela llama al backend cuando el pago se resuelve.
gw -> api : POST /webhook/pago-aprobado
api -> db : UPDATE orden SET estado = pagada
api -> gw : 200 OK

// "mail" no fue declarado con "participant": se autodeclara con su
// propio id como label al usarse acá por primera vez.
api -> mail : Enviar email de confirmación
mail -> cliente : "Tu compra fue exitosa"
`,
  },
];
