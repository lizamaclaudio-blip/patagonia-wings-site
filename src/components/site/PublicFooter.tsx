import Image from "next/image";
import Link from "next/link";

const footerGroups = [
  {
    title: "Comunidad",
    links: [
      { href: "/profile", label: "Pilotos" },
      { href: "/dashboard?tab=training", label: "Eventos" },
      { href: "/certifications", label: "Reglamento" },
      { href: "/#nosotros", label: "Staff" },
    ],
  },
  {
    title: "Recursos",
    links: [
      { href: "/#faq", label: "Ayuda" },
      { href: "/certifications", label: "Guias" },
      { href: "/#descargas", label: "Descargas" },
      { href: "/#servicios", label: "Estado de servicios" },
    ],
  },
  {
    title: "Operaciones",
    links: [
      { href: "/routes", label: "Rutas" },
      { href: "/#flota", label: "Flota" },
      { href: "/#descargas", label: "ACARS" },
      { href: "/dashboard?tab=dispatch", label: "Despacho" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/#legal", label: "Terminos" },
      { href: "/#legal", label: "Privacidad" },
      { href: "/#legal", label: "Cookies" },
    ],
  },
];

export default function PublicFooter() {
  return (
    <footer className="pw-footer" id="legal">
      <div className="pw-container">
        <div className="pw-footer-grid">
          <div className="pw-footer-brand">
            <Image
              src="/branding/patagonia-logo.png"
              alt="Patagonia Wings"
              width={190}
              height={80}
              className="h-auto w-[178px] object-contain"
            />
            <p>
              Aerolínea virtual con base en la Patagonia, creada para pilotos que buscan realismo,
              operación y comunidad.
            </p>
            <div className="pw-footer-social" aria-label="Canales sociales">
              <span>Discord</span>
              <span>Facebook</span>
              <span>Instagram</span>
              <span>YouTube</span>
            </div>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title} className="pw-footer-group">
              <h3>{group.title}</h3>
              {group.links.map((link) => (
                <Link key={`${group.title}-${link.href}-${link.label}`} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}

          <div className="pw-footer-news">
            <h3>Mantente informado</h3>
            <p>Noticias, eventos y actualizaciones de Patagonia Wings.</p>
            <Link href="/register" className="pw-btn-primary">
              Unirme a la comunidad
            </Link>
          </div>
        </div>

        <div className="pw-footer-bottom">
          <span>(c) 2026 Patagonia Wings. Todos los derechos reservados.</span>
          <span>Hecho para operaciones virtuales serias en Sudamérica.</span>
        </div>
      </div>
    </footer>
  );
}
