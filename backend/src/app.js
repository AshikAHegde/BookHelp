const express = require('express');

const authRoutes = require('./routes/authRoutes');
const bookRoutes = require('./routes/bookRoutes');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

const app = express();

app.use(express.json());

/**
 * Returns a simple health check response.
 * @param {import('express').Request} req Incoming request object.
 * @param {import('express').Response} res Response object used to send the health payload.
 * @returns {void}
 */
const healthCheck = (req, res) => {
	res.json({
		success: true,
		message: 'AI Textbook Tutor backend is running',
	});
};

app.get('/health', healthCheck);

app.use('/auth', authRoutes);
app.use('/books', bookRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
