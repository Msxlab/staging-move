\# Environment Rules



Default:

\- Use local, staging, and QA only.



Forbidden:

\- Do not print secrets.

\- Do not commit .env files.

\- Do not modify production environment files.

\- Do not run production migrations.

\- Do not run destructive database commands.

\- Do not use live billing or provider credentials.



Allowed:

\- Read safe metadata.

\- Inspect package.json.

\- Inspect source code.

\- Run safe lint/typecheck/test/build commands.

\- Create branches.

\- Prepare PR summaries.

