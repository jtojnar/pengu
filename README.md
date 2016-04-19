pengu
=====

**pengu** is lightweight web chat built with HTML5 resembling Club Penguin.

Installation
------------

1. Create the following table in PostgreSQL database and set `DATABASE_URL` to correct connection string.

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
4. Start with `npm start`, the game will run on port set by `PORT` env variable.

Configuration
-------------

pengu uses these environment variables for configuration:

* `PORT` – The port a web server will be running on; if not specified it defaults to `8080`.
* `DATABASE_URL` – Connection string of PostgreSQL database; if ommited, persistence will be missing.

Licensed under MIT.
