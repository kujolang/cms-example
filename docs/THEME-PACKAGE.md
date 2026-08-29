# Field Notes Theme Package

Field Notes is the bundled default theme for this showcase, while its independent, forkable home is [`kujolang/cms-field-notes-theme`](https://github.com/kujolang/cms-field-notes-theme). The standalone repository contains only the public theme, its package manifest, build setup, assets, and ZIP packager; it does not carry CMS Studio.

## Reuse

1. Copy or fork `cms-field-notes-theme`.
2. Set `CMS_BASE_URL` to the target Kujo CMS delivery API.
3. Change package identity and distribution fields in `kujo-theme.json`.
4. Keep entrypoint, template, and asset paths aligned with the repository.
5. Validate the manifest against a Kujo CMS instance:

```bash
bash /path/to/cms/scripts/cms-extensions.sh theme:validate kujo-theme.json
```

6. Install it with an administration token:

```bash
CMS_API_TOKEN=... bash /path/to/cms/scripts/cms-extensions.sh theme:install-zip dist/cms-field-notes-theme.zip active
```

Administrators can upload the same ZIP from **CMS Studio → Themes & plugins**. The administration adapter verifies the archive and sends its manifest plus a digest-bound package receipt to the CMS. A deployment adapter remains responsible for building and serving theme code in an isolated environment.

## Customization

Theme settings must be declared in `settings_schema` and supplied through the CMS package installation API. Do not place credentials, CMS administration tokens, signing secrets, or private connector URLs in theme defaults or distribution metadata.

Reusable presentation components live under `app/`. CMS communication and server-side authentication boundaries live under `lib/`. Keep the public frontend dependent only on delivery routes; keep administration credentials on the server.
