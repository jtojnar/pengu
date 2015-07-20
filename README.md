pengu
=====

**pengu** is lightweight web chat built with HTML5 resembling Club Penguin.

1. Create following table in PostgreSQL database and set `DATABASE_URL` to correct connection string.

```
CREATE TABLE "penguin" (
	"name" character varying NOT NULL PRIMARY KEY,
	"closet" json DEFAULT '[]' NOT NULL,
	"clothing" json DEFAULT '[]' NOT NULL,
	"registered" timestamptz DEFAULT current_timestamp NOT NULL
);
```

2. Run `npm install`
3. Compile assets using `gulp`
4. Start with `foreman start`, defaults to port 5000 (configurable via `PORT` env variable).

Licensed under MIT.
