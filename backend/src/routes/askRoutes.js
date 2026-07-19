const express = require('express');

const { askBookHelp } = require('../services/askService');

const router = express.Router();

router.post('/ask', async (req, res, next) => {
	try {
		const result = await askBookHelp(req);
		res.json({
			success: true,
			...result,
		});
	} catch (error) {
		res.status(error.statusCode || 500);
		next(error);
	}
});

module.exports = router;
