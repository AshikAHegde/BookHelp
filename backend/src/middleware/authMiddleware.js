const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		res.status(401);
		throw new Error('Not authorized, token missing');
	}

	const token = authHeader.split(' ')[1];

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);

		req.user = {
			id: decoded.id,
			email: decoded.email,
		};

		next();
	} catch (error) {
		res.status(401);
		throw new Error('Not authorized, token failed');
	}
};

module.exports = {
	protect,
};
