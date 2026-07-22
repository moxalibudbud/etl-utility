# Frontend Agent Guidelines

Instructions for coding agents:

This project is a boilerplate for a React frontend using Vite, TypeScript, React Router, shadcn/ui, Tailwind CSS, and Lucide React icons.
It has an implementation of a Config Builder UI that allows users to build a config for the ETL utility defined in ./docs/config-builder-ui-improvement.md.
We used this boilerplate as a starting point for the project because some of the implementation is in frontend/src/lib/schema.

DON'T DELETE THE EXISING IMPLEMENTATION OF THIS PROJECT to implement ./docs/config-builder-ui-improvement.md. Instead, extend this project to support the new features.

## Stack

The frontend uses:

- Vite
- React
- TypeScript
- React Router in SPA mode
- shadcn/ui
- Tailwind CSS
- Lucide React icons

Do not introduce Next.js, Remix, server components, CSS-in-JS, another
component framework, or another icon library unless explicitly approved.

Use the package manager and commands defined in `frontend/package.json` and
the repository lockfile. Do not create a lockfile for another package manager.

## Application boundaries

The frontend is responsible for:

- Data entry and editing workflows.
- Schema-driven forms and grids.
- CSV import, mapping, validation feedback, and exact-output previews.
- Delivery status visibility.
- Entra ID authentication integration.

## UI component priority

Use this order:

1. Reuse an existing application component.
2. Reuse an existing component from `src/components/ui`.
3. Add the appropriate shadcn/ui component using the configured CLI.
4. Compose a feature component from existing primitives.
5. Build a custom primitive only when shadcn/ui does not provide a suitable
   accessible foundation.

Do not manually recreate a shadcn/ui component available through the CLI.

Do not add another component library for functionality available through
shadcn/ui, Radix UI, or existing project components.

## shadcn/ui boundaries

Treat `src/components/ui` as the generic primitive layer.

Files in `src/components/ui` must:

- Remain generic and reusable.
- Contain no Octo+-specific business rules.
- Contain no API calls.
- Contain no customer-specific behavior.
- Avoid importing feature modules.
- Preserve the accessibility behavior of their Radix primitives.

Place application-specific wrappers and component compositions in feature or
shared application directories.

Keep modifications to generated shadcn components minimal.

## Source organization

Follow existing conventions once established. Until then, prefer:

```text
src/
├── app/
│   ├── router.tsx
│   └── providers.tsx
├── components/
│   ├── ui/
│   └── common/
├── features/
│   └── <feature>/
│       ├── components/
│       ├── hooks/
│       ├── schemas/
│       ├── services/
│       └── types.ts
├── layouts/
├── lib/
├── pages/
├── services/
└── types/