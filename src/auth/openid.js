'use strict';
module.exports = function(app, verify, realm, provider) {
	const openid = require('openid');
	const relyingParty = new openid.RelyingParty(
		verify,
		realm, // Realm (optional, specifies realm for OpenID authentication)
		true, // Use stateless verification
		false, // Strict mode
		[new openid.AttributeExchange()] // List of extensions to enable and include
	);

	app.get('/authenticate', function(req, res) {
		let identifier = provider;

		// Resolve identifier, associate, and build authentication URL
		relyingParty.authenticate(identifier, false, function(error, authUrl) {
			if (error) {
				res.statusCode = 403;
				res.end('Authentication failed: ' + error.message);
			} else if (!authUrl) {
				res.statusCode = 403;
				res.end('Authentication failed');
			} else {
				res.redirect(authUrl);
			}
		});
	});

	app.all('/verify', function(req, res) {
		relyingParty.verifyAssertion(req, function(error, result) {
			if (!error && result.authenticated) {
				console.log(result);
				req.session.user = result.name;
				req.session.group = result.group;
				res.redirect('/');
			} else {
				res.statusCode = 500;
				res.end('Kolo se nám polámalo');
			}
		});
	});
};
