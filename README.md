# pengu

**pengu** is lightweight web chat built with HTML5 resembling Club Penguin.

## Prerequisites

The project uses npm to install dependencies and Node.js to run. Download them by running [Nix](https://nixos.org/download.html)’s `nix-shell` command, using your system’s package manager or from [their website](https://nodejs.org/en/).

Optionally, you will also need [PostgreSQL](https://www.postgresql.org/) database server if you want Pengu to remember player inventories across restarts.

## Installation

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
3. Start with `npm start`, the game will run on port set by `PORT` env variable.

## Configuration

pengu uses the following environment variables for configuration:

* `PORT` – The port a web server will be running on. Of not specified it defaults to `8080`.
* `DATABASE_URL` – [Connection string](https://node-postgres.com/features/connecting/#connection-uri) for the PostgreSQL database. If omitted, persistence will be missing.

Licensed under MIT.
