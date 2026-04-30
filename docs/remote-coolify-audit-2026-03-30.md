# AUDITORIA REMOTA COOLIFY

Fecha: 2026-03-30

| App | Repo | Branch | Source | Auto deploy | Estado | Healthcheck | Dominio |
|---|---|---|---|---|---|---|---|
| APP_ARTES-BUHO | rubencoton/APP_ARTES-BUHO | main | App\Models\GithubApp | github_app_auto | running:unknown | OFF | https://artesbuhomanagement.com |
| APP_ARTES-BUHO_BELLA-BESTIA | rubencoton/APP_ARTES-BUHO_BELLA-BESTIA | main | App\Models\GithubApp | github_app_auto | running:unknown | OFF | https://bella-bestia.artesbuhomanagement.com |
| APP_ARTES-BUHO_CONTABILIDAD | rubencoton/APP_ARTES-BUHO_CONTABILIDAD | main | App\Models\GithubApp | github_app_auto | running:healthy | ON (/health) | https://contabilidad.artesbuhomanagement.com |
| APP_ARTES-BUHO_EMAILING | rubencoton/APP_ARTES-BUHO_EMAILING | main | App\Models\GithubApp | github_app_auto | running:healthy | ON (/) | https://emailing.artesbuhomanagement.com |
| APP_RUBEN-COTON | rubencoton/APP_RUBEN-COTON.git | main | App\Models\GithubApp | github_app_auto | running:healthy | OFF | https://rubencoton.net |

## Conclusiones

- Todas las apps APP_* estan conectadas con Github App.
- En este modo, el despliegue por push queda gestionado por el GitHub App oficial de Coolify.
- No se detectaron apps APP_* fuera de main.
- Hay apps con healthcheck OFF (no bloquea auto-deploy, pero afecta visibilidad de salud).
