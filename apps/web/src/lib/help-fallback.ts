export interface HelpArticleFallback {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string | null;
  category: string;
  tags: string;
  viewCount: number;
  helpfulYes: number;
  helpfulNo: number;
}

export interface FaqFallback {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export const FALLBACK_HELP_ARTICLES: HelpArticleFallback[] = [
  {
    id: "fallback-getting-started",
    slug: "getting-started",
    title: "Getting started",
    excerpt: "Set up your profile, first address, services, and optional moving plan.",
    category: "Getting Started",
    tags: JSON.stringify(["onboarding", "addresses", "services"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Start by completing onboarding, adding your current address, and deciding whether to track providers now or later. Provider selection is optional; you can continue without listed providers and add local/custom providers from Services.",
  },
  {
    id: "fallback-providers-vs-services",
    slug: "providers-vs-services",
    title: "Providers vs. services",
    excerpt: "Understand the difference between directory entries and your tracked accounts.",
    category: "Core Concepts",
    tags: JSON.stringify(["providers", "services"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Providers are listed directory entries or private custom entries, such as a utility, bank, dentist, or gym. Services are your actual tracked accounts tied to an address. Adding a provider creates a local LocateFlow service record; it does not contact or update the provider.",
  },
  {
    id: "fallback-moving-tasks",
    slug: "moving-tasks",
    title: "How moving tasks work",
    excerpt: "Moving tasks are local checklist items for you to complete manually.",
    category: "Moving",
    tags: JSON.stringify(["moving", "tasks"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Moving tasks help you track what to do before and after a move. Completing a task updates LocateFlow only. You still confirm deadlines, availability, account changes, and official requirements directly with the relevant provider or agency.",
  },
  {
    id: "fallback-provider-disclaimer",
    slug: "listed-providers-unverified",
    title: "Listed providers are unverified",
    excerpt: "Provider listings are directory guidance, not availability guarantees.",
    category: "Providers",
    tags: JSON.stringify(["providers", "coverage"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Provider data is listed directory guidance. A provider appearing for a state or category does not guarantee address-level availability. Confirm coverage, pricing, eligibility, and account actions directly with the provider before acting.",
  },
  {
    id: "fallback-account-security",
    slug: "account-security",
    title: "Account and security basics",
    excerpt: "Use Settings to manage passwords, sessions, and account access.",
    category: "Account",
    tags: JSON.stringify(["account", "security"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Use Settings to review account details, security options, and active sessions. If you signed up with Google, use account security to add a password only while signed in.",
  },
  {
    id: "fallback-export-delete",
    slug: "export-delete-data",
    title: "Export or delete your data",
    excerpt: "Download your account data or request account deletion from Settings.",
    category: "Privacy",
    tags: JSON.stringify(["export", "delete", "privacy"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Data export and account deletion controls are available from Settings. Export your data before deletion if you need a copy of supported records. Some backups, billing records, audit logs, legal records, and security records may be retained when needed.",
  },
  {
    id: "fallback-billing-basics",
    slug: "billing-basics",
    title: "Billing basics",
    excerpt: "Current billing flows are available from Settings when configured.",
    category: "Billing",
    tags: JSON.stringify(["billing", "subscription"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Billing and subscription controls appear in Settings when the payment environment is configured. Export/delete data controls remain available regardless of subscription state.",
  },
  {
    id: "fallback-support-contact",
    slug: "support-contact",
    title: "Contact support",
    excerpt: "Open a support ticket from the Support page after signing in.",
    category: "Support",
    tags: JSON.stringify(["support"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "If you need account-specific help, sign in and open a support ticket from Support. Include the page you were on, what you expected, and any non-sensitive error message you saw.",
  },
];

export const FALLBACK_FAQS: FaqFallback[] = [
  {
    id: "fallback-faq-providers-services",
    category: "Core Concepts",
    question: "What is the difference between Providers and Services?",
    answer: "Providers are directory or custom entries. Services are your own tracked accounts tied to an address.",
  },
  {
    id: "fallback-faq-provider-availability",
    category: "Providers",
    question: "Does a listed provider mean it is available at my address?",
    answer: "No. Listings are unverified directory guidance. Confirm availability and account actions directly with the provider.",
  },
  {
    id: "fallback-faq-skip-providers",
    category: "Onboarding",
    question: "Can I continue if no providers are listed?",
    answer: "Yes. Provider selection is optional. You can continue onboarding and add a local/custom provider later from Services.",
  },
  {
    id: "fallback-faq-moving-tasks",
    category: "Moving",
    question: "Does LocateFlow complete provider tasks for me?",
    answer: "No. LocateFlow tracks local checklist progress only; you complete external provider or agency steps yourself.",
  },
  {
    id: "fallback-faq-export-delete",
    category: "Privacy",
    question: "Can I export or delete my data?",
    answer: "Yes. Use Settings to export supported data or start account deletion. Some backups, billing records, audit logs, legal records, and security records may be retained when needed.",
  },
];

export const FALLBACK_HELP_ARTICLES_ES: HelpArticleFallback[] = [
  {
    id: "fallback-es-getting-started",
    slug: "getting-started-es",
    title: "Primeros pasos",
    excerpt: "Configura tu perfil, primera direccion, servicios y plan de mudanza opcional.",
    category: "Primeros pasos",
    tags: JSON.stringify(["onboarding", "direcciones", "servicios"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Empieza completando el onboarding, agregando tu direccion actual y decidiendo si quieres registrar proveedores ahora o despues. La seleccion de proveedores es opcional; puedes continuar sin proveedores listados y agregar proveedores locales o personalizados desde Servicios.",
  },
  {
    id: "fallback-es-providers-vs-services",
    slug: "providers-vs-services-es",
    title: "Proveedores vs. servicios",
    excerpt: "Entiende la diferencia entre entradas del directorio y tus cuentas registradas.",
    category: "Conceptos basicos",
    tags: JSON.stringify(["proveedores", "servicios"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Los proveedores son entradas del directorio o entradas personalizadas, como una compania de servicios publicos, banco, dentista o gimnasio. Los servicios son tus cuentas reales registradas y conectadas a una direccion. Agregar un proveedor crea un registro local en LocateFlow; no contacta ni actualiza al proveedor.",
  },
  {
    id: "fallback-es-moving-tasks",
    slug: "moving-tasks-es",
    title: "Como funcionan las tareas de mudanza",
    excerpt: "Las tareas de mudanza son una lista local para completar manualmente.",
    category: "Mudanza",
    tags: JSON.stringify(["mudanza", "tareas"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Las tareas de mudanza te ayudan a seguir lo que debes hacer antes y despues de mudarte. Completar una tarea solo actualiza LocateFlow. Siempre confirma fechas, disponibilidad, cambios de cuenta y requisitos oficiales directamente con el proveedor o agencia correspondiente.",
  },
  {
    id: "fallback-es-provider-disclaimer",
    slug: "listed-providers-unverified-es",
    title: "Los proveedores listados no estan verificados",
    excerpt: "Los listados son guia de directorio, no garantias de disponibilidad.",
    category: "Proveedores",
    tags: JSON.stringify(["proveedores", "cobertura"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Los datos de proveedores son guia de directorio. Que un proveedor aparezca para un estado o categoria no garantiza disponibilidad exacta en tu direccion. Confirma cobertura, precios, elegibilidad y acciones de cuenta directamente con el proveedor antes de actuar.",
  },
  {
    id: "fallback-es-account-security",
    slug: "account-security-es",
    title: "Cuenta y seguridad",
    excerpt: "Usa Configuracion para administrar contrasena, sesiones y acceso.",
    category: "Cuenta",
    tags: JSON.stringify(["cuenta", "seguridad"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Usa Configuracion para revisar detalles de cuenta, opciones de seguridad y sesiones activas. Si te registraste con Google, puedes agregar una contrasena desde seguridad de cuenta mientras tienes la sesion iniciada.",
  },
  {
    id: "fallback-es-export-delete",
    slug: "export-delete-data-es",
    title: "Exportar o eliminar tus datos",
    excerpt: "Descarga tus datos o inicia eliminacion de cuenta desde Configuracion.",
    category: "Privacidad",
    tags: JSON.stringify(["exportar", "eliminar", "privacidad"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Los controles de exportacion y eliminacion estan disponibles desde Configuracion. Exporta tus datos antes de eliminar la cuenta si necesitas una copia de los registros compatibles. Algunas copias de seguridad, registros de facturacion, auditoria, legales y seguridad pueden conservarse cuando sea necesario.",
  },
  {
    id: "fallback-es-billing-basics",
    slug: "billing-basics-es",
    title: "Facturacion basica",
    excerpt: "Los controles de suscripcion aparecen en Configuracion cuando estan configurados.",
    category: "Facturacion",
    tags: JSON.stringify(["facturacion", "suscripcion"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Los controles de facturacion y suscripcion aparecen en Configuracion cuando el entorno de pagos esta configurado. Los controles de exportar o eliminar datos siguen disponibles sin importar el estado de suscripcion.",
  },
  {
    id: "fallback-es-support-contact",
    slug: "support-contact-es",
    title: "Contactar soporte",
    excerpt: "Abre un ticket de soporte desde la pagina Soporte despues de iniciar sesion.",
    category: "Soporte",
    tags: JSON.stringify(["soporte"]),
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    content: "Si necesitas ayuda especifica de cuenta, inicia sesion y abre un ticket desde Soporte. Incluye la pagina donde estabas, lo que esperabas y cualquier mensaje de error no sensible que viste.",
  },
];

export const FALLBACK_FAQS_ES: FaqFallback[] = [
  {
    id: "fallback-es-faq-providers-services",
    category: "Conceptos basicos",
    question: "Cual es la diferencia entre Proveedores y Servicios?",
    answer: "Los proveedores son entradas del directorio o personalizadas. Los servicios son tus propias cuentas registradas y conectadas a una direccion.",
  },
  {
    id: "fallback-es-faq-provider-availability",
    category: "Proveedores",
    question: "Un proveedor listado significa que esta disponible en mi direccion?",
    answer: "No. Los listados son guia no verificada. Confirma disponibilidad y acciones de cuenta directamente con el proveedor.",
  },
  {
    id: "fallback-es-faq-skip-providers",
    category: "Onboarding",
    question: "Puedo continuar si no hay proveedores listados?",
    answer: "Si. La seleccion de proveedores es opcional. Puedes continuar el onboarding y agregar un proveedor local o personalizado despues desde Servicios.",
  },
  {
    id: "fallback-es-faq-moving-tasks",
    category: "Mudanza",
    question: "LocateFlow completa las tareas de proveedores por mi?",
    answer: "No. LocateFlow solo registra el progreso local de tu lista; tu completas los pasos externos con el proveedor o agencia.",
  },
  {
    id: "fallback-es-faq-export-delete",
    category: "Privacidad",
    question: "Puedo exportar o eliminar mis datos?",
    answer: "Si. Usa Configuracion para exportar datos compatibles o iniciar eliminacion de cuenta. Algunos registros pueden conservarse cuando sea necesario.",
  },
];
