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
// Las entidades se declaran una vez (id, forma y label) y el flujo solo
// las conecta. Usa las tres formas y aristas con y sin etiqueta.
entity inicio (Cliente en el carrito)
entity checkout [Confirmar compra]
entity stock {¿Hay stock?}
entity sinstock [Mostrar "sin stock"]
entity reservar [Reservar inventario]
entity crearorden [Crear orden pendiente]
entity pago [Redirigir a pasarela de pago]
entity resultado {¿Pago aprobado?}
entity reintentar {¿Reintentar pago?}
entity confirmar [Confirmar orden]
entity email [Enviar email de confirmación]
entity liberar [Liberar inventario reservado]
entity exito (Compra exitosa)
entity cancelada (Orden cancelada)

flow compra "Flujo de compra" {
  inicio -> checkout
  checkout -> stock
  stock -> sinstock : no
  stock -> reservar : sí
  sinstock -> inicio : volver al carrito

  // Las entidades pueden declararse en cualquier parte del archivo;
  // el orden no importa.
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
}
`,
  },
  {
    id: "sequence",
    title: "Secuencia",
    source: `// El mismo flujo de compra que 01-flowchart.flo, pero como secuencia:
// frontend, backend, pasarela de pago y el webhook async de confirmación.
// El orden de las columnas es el orden en que se declaran las entidades.
entity cliente [Cliente]       type: actor
entity web     [Web]           type: frontend
entity api     [Backend]       type: service, tags: http
entity gw      [Pasarela de pago] {
  type: external
  tags: http pagos
}
entity db      [Base de datos] type: store
entity mail

sequence checkout "Checkout" {
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
}

// El webhook llega en su propia request, fuera del flujo síncrono: va en
// su propio bloque, sobre las mismas entidades.
sequence webhook "Webhook de pago" {
  gw -> api : POST /webhook/pago-aprobado
  api -> db : UPDATE orden SET estado = pagada
  api -> gw : 200 OK
  api -> mail : Enviar email de confirmación
  mail -> cliente : "Tu compra fue exitosa"
}
`,
  },
];
