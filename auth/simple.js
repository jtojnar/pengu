'use strict';
module.exports = function(app) {
	app.get('/authenticate', function(req, res) {
		if (req.query.name) {
			req.session.user = req.query.name;
			req.session.group = 'basic';
			res.redirect('/');
		} else {
			res.set('Content-Type', 'text/html');
			res.send(`
				<meta charset="utf-8">
				<form action="" method="get">
				<label>Přezdívka: <input type="text" name="name"></label>
				<button type="submit">Přihlásit se</button>
				</form>
			`);
		}
	});
}
