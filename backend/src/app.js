const express = require('express');

const authRoutes = require('./routes/authRoutes');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
	res.json({
		success: true,
		message: 'AI Textbook Tutor backend is running',
	});
});

app.use('/', authRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
