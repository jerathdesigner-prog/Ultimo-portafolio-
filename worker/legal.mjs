export const LEGAL_VERSION = '2026-11-07.2';
export const LEGAL_EMAIL = 'jerathdesigner@gmail.com';
export const LEGAL_OWNER = 'Jerath Raúl Chancay Moreira';
// Immutable versions are also snapshotted with their hash in D1 when accepted.
export const documents = {
  terminos: {
    title: 'Términos y condiciones',
    sections: [
      ['Responsable y contacto', `${LEGAL_OWNER}, nombre comercial Jerath Moreira. Servicios de diseño gráfico desde Portoviejo, Ecuador. Contacto y notificaciones: ${LEGAL_EMAIL}. No se ofrece atención presencial en este sitio.`],
      ['Uso del portafolio', 'Este sitio presenta trabajos y permite preparar una solicitud. Navegar no crea un contrato ni supone aceptar condiciones por silencio. Copiar o descargar una solicitud tampoco contrata un servicio, reserva fechas ni genera una obligación de pago.'],
      ['Contratación de servicios', 'Antes de contratar, el presupuesto escrito deberá identificar a las partes, alcance, entregables, revisiones, calendario, precio total, impuestos, forma de pago permitida y condiciones de cancelación. El encargo comienza al aceptar ese acuerdo. No se solicitan pagos ni datos bancarios en este sitio.'],
      ['Materiales y propiedad intelectual', 'El cliente deberá facilitar materiales que pueda utilizar y comunicar las restricciones de sus licencias. La entrega de archivos, las licencias y una eventual cesión de derechos se determinarán por escrito para cada proyecto, respetando los derechos irrenunciables. Mostrar una obra aquí no concede permiso para reutilizarla ni implica que todas las marcas o componentes pertenezcan al diseñador. Las imágenes del personaje son representaciones generadas con IA según la declaración del titular.'],
      ['Comunicaciones y servicios externos', 'Los enlaces a WhatsApp y redes sociales abren servicios de terceros con sus propias condiciones y políticas. Evita enviar contraseñas, documentos de identidad o datos sensibles en una solicitud de diseño.'],
      ['Responsabilidad y derechos del cliente', 'No se garantizan resultados comerciales, ventas o exclusividad de elementos generados con IA. Esto no excluye la responsabilidad legal que corresponda ni limita garantías o derechos obligatorios. Cualquier desacuerdo puede comunicarse al correo indicado; no se impone arbitraje ni renuncia a acudir a autoridades o tribunales competentes.'],
      ['Normativa y actualizaciones', 'La actividad se desarrolla desde Ecuador. Cuando resulten aplicables normas obligatorias de protección al consumidor o de datos de otro país, estas prevalecerán. Cada aceptación registra su versión; los cambios posteriores no modifican retroactivamente acuerdos ya celebrados.'],
    ],
  },
  privacidad: {
    title: 'Política de privacidad',
    sections: [
      ['Quién trata los datos', `${LEGAL_OWNER}, desde Portoviejo, Ecuador. Para consultas, ejercicio de derechos y reclamaciones: ${LEGAL_EMAIL}.`],
      ['Solicitud de proyecto', 'El formulario solo necesita una descripción de la idea. Nombre o alias, servicios y fecha son opcionales. El texto se prepara, copia o descarga en el dispositivo: no se envía al servidor del portafolio. Si decides compartirlo por correo o WhatsApp, recibiremos los datos que incluyas para atender tu petición y, si procede, negociar o ejecutar el encargo. No incluyas datos sensibles o documentos de identidad.'],
      ['Justificantes y finalidades', 'Al copiar o descargar se registra un identificador aleatorio del navegador, fecha y hora del servidor, acción realizada, las dos casillas, versión y huella del texto legal. No se guarda el nombre, la idea, la IP ni el navegador en ese justificante. La lectura de privacidad es una confirmación informativa, no un consentimiento para publicidad. Los justificantes documentan preferencias y actuaciones; no verifican la identidad civil de una persona ni son una firma electrónica certificada.'],
      ['Bases del tratamiento', 'Las solicitudes compartidas se atienden para actuaciones precontractuales solicitadas por ti o ejecución del encargo. La analítica opcional se basa en tu consentimiento, que puedes retirar. Los justificantes se conservan de forma limitada para acreditar tus elecciones y atender reclamaciones. No se usa el formulario para marketing.'],
      ['Analítica opcional', 'Solo con autorización se cuentan visitas, aperturas de proyectos y clics de contacto. Se reciben IP y navegador durante la petición para calcular un seudónimo diario con clave; no se guardan esos valores originales en la tabla analítica. Se almacenan tipo de evento, fecha, sesión seudónima, proyecto, país aproximado, clase de dispositivo y dominio de procedencia sin ruta ni búsqueda. La seudonimización no convierte estos datos en anónimos. Se respetan las señales DNT y GPC.'],
      ['Proveedores y comunicaciones internacionales', 'La web, sus registros técnicos y las bases D1/R2 se alojan en Cloudflare, que utiliza infraestructura internacional. WhatsApp/Meta, el proveedor de correo, las redes y los bancos pueden intervenir cuando eliges esos canales, conforme a sus propias políticas. No se venden datos. Puedes solicitar información sobre los proveedores y el tratamiento de tus datos en el correo de contacto.'],
      ['Plazos y seguridad', 'Las preferencias duran hasta 180 días. Los justificantes se eliminan al superar 365 días mediante mantenimiento programado. La analítica conserva una ventana máxima de 180 días. Las comunicaciones de un encargo se conservan durante su gestión y los plazos necesarios para cumplir obligaciones legales o atender reclamaciones; puedes solicitar información del plazo aplicable a tu caso. El admin requiere autenticación y los justificantes no son públicos. Cloudflare puede mantener registros técnicos conforme a sus condiciones.'],
      ['Tus derechos', `Puedes solicitar acceso, rectificación, actualización, eliminación, oposición, limitación o suspensión, portabilidad y retiro del consentimiento, según corresponda, escribiendo a ${LEGAL_EMAIL}. Incluye tu justificante si lo tienes; solo se pedirá verificación proporcional cuando sea necesaria. Retirar la analítica no impide usar el sitio. Puedes reclamar ante la Superintendencia de Protección de Datos Personales de Ecuador (www.spdp.gob.ec), sin perjuicio de otras autoridades competentes. No se adoptan decisiones con efectos legales basadas exclusivamente en perfiles automatizados.`],
      ['Menores', 'No se solicita edad ni información de menores. Un encargo que requiera representación legal deberá gestionarse con quien corresponda.'],
    ],
  },
  cookies: {
    title: 'Política de cookies',
    sections: [
      ['Elección previa', 'La analítica opcional está desactivada hasta que pulses “Aceptar analítica”. “Solo necesarias” permite navegar sin ella. Cerrar o ignorar el aviso no es aceptar. Puedes cambiar o retirar tu decisión con “Preferencias de privacidad” al pie de la web.'],
      ['Almacenamiento necesario', 'jm_privacy: cookie propia, firmada, HttpOnly, Secure y SameSite=Strict; recuerda la elección, con identificador aleatorio y vencimiento de hasta 180 días. Se crea al guardar una elección o un justificante del formulario. jerath_session: cookie propia del administrador, HttpOnly, Secure y SameSite=Strict, con duración máxima de 12 horas; mantiene su acceso privado. No se utiliza para publicidad. Las cookies necesarias no se presentan como una autorización para seguimiento.'],
      ['Almacenamiento opcional', 'jm-visit en sessionStorage mantiene un identificador de sesión de analítica solo si la autorizas. Desaparece al cerrar la sesión de navegación o retirar el permiso. Los eventos se envían al propio servidor. No se cargan píxeles publicitarios ni analítica de terceros desde este mecanismo.'],
      ['Servicios externos y navegador', 'WhatsApp y redes sociales se abren únicamente al seguir sus enlaces; sus propias cookies se rigen por sus políticas. Cloudflare puede aplicar medidas técnicas de seguridad dependientes de su configuración, que deben revisarse en la cuenta. Puedes borrar cookies desde el navegador; se perderán preferencias o sesiones. Si el almacenamiento está bloqueado, la analítica permanece apagada.'],
    ],
  },
  reembolsos: {
    title: 'Política de cancelación y reembolso',
    sections: [
      ['Antes del pago', 'Este portafolio no tiene compra ni pago automático. Antes de cualquier abono recibirás un presupuesto escrito con alcance, entregables, etapas, precio total, revisiones y condiciones de cancelación. No se aplica una regla general de “sin reembolsos”. Los derechos obligatorios del consumidor prevalecen.'],
      ['Cancelación y trabajo realizado', 'Si necesitas cancelar, comunícalo por escrito. Se revisarán el acuerdo, los importes abonados, las etapas efectivamente ejecutadas y los gastos expresamente autorizados. Cualquier liquidación deberá estar justificada; no se retendrá automáticamente todo el anticipo. El presupuesto debe concretar este procedimiento antes de cobrar.'],
      ['Incumplimiento o entrega con problemas', 'Si el servicio no corresponde a lo pactado, informa del problema para evaluar la corrección, nueva ejecución o devolución que corresponda. No se eliminan garantías legales ni se condicionan reclamaciones obligatorias a plazos inventados por esta web.'],
      ['Contratación a distancia', 'Los derechos legales de devolución o desistimiento dependen de la normativa aplicable, la naturaleza del servicio y las condiciones de ejecución. Antes de iniciar un encargo internacional o personalizado se deberán comunicar los derechos y, si procede, obtener las solicitudes expresas exigidas por la ley. Aceptar los términos no supone renunciar a esos derechos.'],
      ['Cómo solicitarlo', `Escribe a ${LEGAL_EMAIL} indicando el encargo, fecha y motivo. No envíes claves bancarias ni frases semilla. Una devolución acordada se tramitará por un medio legalmente permitido y verificable. El importe, medio y plazo se comunicarán por escrito, respetando tus derechos obligatorios.`],
    ],
  },
};
export const checkboxText = {
  terms: 'He leído y acepto los términos para preparar esta solicitud.',
  privacy: 'He leído la política de privacidad y la información sobre el justificante de esta acción.',
};
export const cookieNotice = {
  text: 'La analítica es opcional. Puedes aceptarla, rechazarla o cambiar tu elección al pie de la web.',
  accept: 'Aceptar analítica',
  reject: 'Solo necesarias',
};
export const legalSnapshot = JSON.stringify({ version: LEGAL_VERSION, documents, checkboxText, cookieNotice });
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function legalPage(slug) {
  const doc = documents[slug];
  if (!doc) return new Response('No encontrado', { status: 404 });
  const nav = Object.entries(documents).map(([key, value]) => `<a href="/legal/${key}"${key === slug ? ' aria-current="page"' : ''}>${value.title}</a>`).join('');
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(doc.title)} · Jerath Moreira</title><link rel="stylesheet" href="/static/privacy.css"></head><body class="jm-legal-page"><header><a href="/">← Volver al portafolio</a><nav aria-label="Información legal">${nav}</nav></header><main><h1>${esc(doc.title)}</h1><p>Versión ${LEGAL_VERSION} · 7 de noviembre de 2026</p>${doc.sections.map(([heading, text]) => `<section><h2>${esc(heading)}</h2><p>${esc(text)}</p></section>`).join('')}</main><footer><a href="mailto:${LEGAL_EMAIL}">${LEGAL_EMAIL}</a></footer></body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'same-origin', 'content-security-policy': "default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'" } });
}
