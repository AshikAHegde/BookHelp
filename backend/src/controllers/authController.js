const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const asyncHandler = require('../middleware/asyncHandler');
const { createUser, findUserByEmail } = require('../models/userModel');

const createToken = (user) => {
	return jwt.sign(
		{
			id: user.id,
			email: user.email,
		},
		process.env.JWT_SECRET,
		{
			expiresIn: process.env.JWT_EXPIRES_IN || '7d',
		}
	);
};

const registerUser = asyncHandler(async (req, res) => {
	const { name, email, password } = req.body;

	if (!name || !email || !password) {
		res.status(400);
		throw new Error('Name, email, and password are required');
	}

	const existingUser = await findUserByEmail(email);

	if (existingUser) {
		res.status(409);
		throw new Error('Email already exists');
	}

	const hashedPassword = await bcrypt.hash(password, 10);
	const userId = await createUser({ name, email, password: hashedPassword });

	const user = {
		id: userId,
		name,
		email,
	};

	res.status(201).json({
		success: true,
		message: 'User registered successfully',
		user,
		token: createToken(user),
	});
});

const loginUser = asyncHandler(async (req, res) => {
	const { email, password } = req.body;

	if (!email || !password) {
		res.status(400);
		throw new Error('Email and password are required');
	}

	const user = await findUserByEmail(email);

	if (!user) {
		res.status(401);
		throw new Error('Invalid email or password');
	}

	const isPasswordValid = await bcrypt.compare(password, user.password);

	if (!isPasswordValid) {
		res.status(401);
		throw new Error('Invalid email or password');
	}

	const tokenUser = {
		id: user.id,
		name: user.name,
		email: user.email,
	};

	res.json({
		success: true,
		message: 'Login successful',
		user: tokenUser,
		token: createToken(tokenUser),
	});
});

module.exports = {
	registerUser,
	loginUser,
};
