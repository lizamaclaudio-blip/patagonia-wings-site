# PatagoniaWings.Web

Bloque Web 1 listo con base visual premium y rutas operativas mock:

- `/`
- `/login`
- `/register`
- `/dashboard`
- `/profile`
- `/certifications`

## Ejecutar

```bash
npm install
npm run dev
```

La app corre en:

```text
http://localhost:3001
```

## Notas

- Este bloque usa datos mock.
- La siguiente etapa conectará Auth, perfil persistente y Supabase.
- Si aparece un hydration mismatch con atributos extra en `<body>`, normalmente proviene de extensiones del navegador.
