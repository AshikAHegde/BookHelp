const db = require('../config/db');

const findUserByEmail = async (email) => {
	const [rows] = await db.query(
		'SELECT id, name, email, password FROM users WHERE email = ? LIMIT 1',
		[email]
	);

	return rows[0] || null;
};

const createUser = async ({ name, email, password }) => {
	const [result] = await db.query(
		'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
		[name, email, password]
	);

	return result.insertId;
};

module.exports = {
	findUserByEmail,
	createUser,
};
