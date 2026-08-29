# Field Notes Theme Package

Field Notes is a portable Kujo CMS theme. Its root `kujo-theme.json` declares the public package contract, frontend entrypoints, templates, assets, settings, CMS compatibility, content types, and menu locations.

## Reuse

1. Copy or fork this repository.
2. Set `CMS_BASE_URL` to the target Kujo CMS delivery API.
3. Change package identity and distribution fields in `kujo-theme.json`.
4. Keep entrypoint, template, and asset paths aligned with the repository.
5. Validate the manifest against a Kujo CMS instance:

```bash
bash /path/to/cms/scripts/cms-extensions.sh theme:validate kujo-theme.json
```

6. Install it with an administration token:

```bash
CMS_API_TOKEN=... bash /path/to/cms/scripts/cms-extensions.sh theme:install kujo-theme.json active
```

Installation registers the normalized manifest and settings. It does not upload, download, build, or execute the frontend repository. The deployment system remains responsible for fetching an immutable release, checking its declared integrity digest, building it in isolation, and serving it with the correct CMS URL.

## Customization

Theme settings must be declared in `settings_schema` and supplied through the CMS package installation API. Do not place credentials, CMS administration tokens, signing secrets, or private connector URLs in theme defaults or distribution metadata.

Reusable presentation components live under `app/`. CMS communication and server-side authentication boundaries live under `lib/`. Keep the public frontend dependent only on delivery routes; keep administration credentials on the server.
