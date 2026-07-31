const jwt = require('jsonwebtoken');
const { Pinecone } = require('@pinecone-database/pinecone');

const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'models/gemini-embedding-001';
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'models/gemini-3.5-flash';
const EMBEDDING_DIMENSION = Number(process.env.EMBEDDING_DIMENSION || '1024');

function firstText(...values) {
	for (const value of values) {
		if (typeof value === 'string') {
			const text = value.trim();
			if (text) return text;
		}
	}

	return null;
}

function extractQueryText(req) {
	return firstText(
		req.body?.query,
		req.body?.text,
		req.body?.message,
		req.body?.question,
		req.body?.chat?.message,
		req.body?.chat?.text,
		req.headers['x-user-query'],
		req.headers['x-query'],
		req.headers['x-message'],
		req.headers['x-question'],
		req.query?.query,
		req.query?.q
	);
}

function decodeStandardFromAuth(req) {
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

	const token = authHeader.split(' ')[1];
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		return decoded?.standard ?? null;
	} catch {
		return null;
	}
}

function getEnvOrThrow(name) {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is not set`);
	return value;
}

async function fetchGemini(path, body) {
	const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${path}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-goog-api-key': getEnvOrThrow('GEMINI_API_KEY'),
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const bodyText = await response.text();
		throw new Error(`Gemini request failed: ${response.status} ${bodyText}`);
	}

	return response.json();
}

async function embedWithGemini(texts) {
	const data = await fetchGemini(`${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`, {
		requests: texts.map((text) => ({
			model: GEMINI_EMBEDDING_MODEL,
			taskType: 'RETRIEVAL_DOCUMENT',
			outputDimensionality: EMBEDDING_DIMENSION,
			content: { parts: [{ text }] },
		})),
	});

	return (data.embeddings ?? []).map((embedding) => embedding.values ?? []);
}

async function generateWithGemini(question, context) {
	const prompt = [
		'You are BookHelp Tutor. Answer the user using ONLY the provided textbook excerpts in the Context.',
		'If the context is insufficient, say you cannot find the answer in the provided excerpts and ask a clarifying question.',
		'Keep the answer clear and in simple language.',
		'',
		'Context:',
		context,
		'',
		`User question: ${question}`,
	].join('\n');

	const data = await fetchGemini(`${GEMINI_CHAT_MODEL}:generateContent`, {
		contents: [
			{
				role: 'user',
				parts: [{ text: prompt }],
			},
		],
	});

	return (
		data?.candidates?.[0]?.content?.parts?.map((part) => part?.text).filter(Boolean).join('') ||
		''
	).trim();
}

async function generateWithFallback(question, context) {
	const systemPrompt =
		'You are BookHelp Tutor. Answer the user using ONLY the provided textbook excerpts in the Context. If the context is insufficient, say you cannot find the answer in the provided excerpts and ask a clarifying question. Keep the answer clear and in simple language.';
	const userContent = `Context:\n${context}\n\nUser question: ${question}`;

	// 1. Try official Mistral AI API if MISTRAL_API_KEY is available
	if (process.env.MISTRAL_API_KEY) {
		try {
			const model = process.env.MISTRAL_MODEL || 'mistral-small-latest';
			const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
				},
				body: JSON.stringify({
					model,
					messages: [
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: userContent },
					],
					temperature: 0.3,
				}),
			});

			if (response.ok) {
				const data = await response.json();
				return data?.choices?.[0]?.message?.content?.trim() || '';
			}
			console.warn(`Mistral API returned ${response.status}, attempting Groq fallback...`);
		} catch (err) {
			console.warn('Mistral API error:', err.message);
		}
	}

	// 2. Try Groq API (which hosts Llama, Mixtral, etc.) if GROQ_API_KEY is available
	if (process.env.GROQ_API_KEY) {
		const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
		const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
			},
			body: JSON.stringify({
				model,
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: userContent },
				],
				temperature: 0.3,
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Groq API fallback failed (${response.status}): ${errorText}`);
		}

		const data = await response.json();
		return data?.choices?.[0]?.message?.content?.trim() || '';
	}

	throw new Error('No fallback API key (MISTRAL_API_KEY or GROQ_API_KEY) is configured.');
}

async function generateAnswer(question, context) {
	try {
		return await generateWithGemini(question, context);
	} catch (geminiError) {
		console.warn('Gemini generation failed, trying fallback provider:', geminiError.message);
		try {
			return await generateWithFallback(question, context);
		} catch (fallbackError) {
			console.error('Fallback generation also failed:', fallbackError.message);
			throw geminiError;
		}
	}
}

function parseTopK(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 5;
}

function getSources(matches) {
	return matches
		.map(({ score, metadata = {} }) => ({
			score: score ?? null,
			chapter: metadata.chapter_name ?? metadata.chapter ?? null,
			page: metadata.page ?? null,
			text: metadata.text ?? null,
		}))
		.filter((source) => Boolean(source.text));
}

function formatConversationHistory(history) {
	if (!Array.isArray(history)) return '';

	return history
		.filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.text === 'string')
		.slice(-10)
		.map((item) => `${item.role === 'user' ? 'User' : 'Assistant'}: ${item.text.trim()}`)
		.join('\n');
}

async function askBookHelp(req) {
	const queryText = extractQueryText(req);
	if (!queryText) {
		const error = new Error('Missing query text in body/header/querystring');
		error.statusCode = 400;
		throw error;
	}

	const standard = req.body?.standard ?? decodeStandardFromAuth(req) ?? null;
	const subject = req.body?.subject ?? req.headers['x-subject'] ?? null;
	const topK = parseTopK(req.body?.topK ?? req.headers['x-topk'] ?? 5);
	const conversationHistory = formatConversationHistory(req.body?.history);

	const requiredEnv = ['PINECONE_API_KEY', 'PINECONE_INDEX_NAME', 'GEMINI_API_KEY'];
	const missingEnv = requiredEnv.filter((key) => !process.env[key]);

	if (missingEnv.length > 0) {
		const error = new Error(`AI is not configured yet (missing env: ${missingEnv.join(', ')}).`);
		error.statusCode = 503;
		error.details = { queryText, standard, subject };
		throw error;
	}

	const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
	const index = pc.Index(process.env.PINECONE_INDEX_NAME);

	const embeddingVectors = await embedWithGemini([queryText]);
	const queryVector = embeddingVectors?.[0];
	if (!Array.isArray(queryVector) || queryVector.length === 0) {
		const error = new Error('Failed to embed query');
		error.statusCode = 500;
		throw error;
	}

	const filter = {};
	if (standard) filter.standard = String(standard);
	if (subject) filter.subject = String(subject);

	const pineconeResponse = await index.query({
		vector: queryVector,
		topK,
		includeMetadata: true,
		...(Object.keys(filter).length > 0 ? { filter } : {}),
		...(process.env.PINECONE_NAMESPACE ? { namespace: process.env.PINECONE_NAMESPACE } : {}),
	});

	const sources = getSources(pineconeResponse?.matches ?? []);
	const context = sources
		.slice(0, topK)
		.map((source, index) => `Excerpt ${index + 1} (page ${source.page ?? 'N/A'}):\n${source.text}`)
		.join('\n\n');
	const answer = await generateAnswer(
		queryText,
		[conversationHistory, context].filter(Boolean).join('\n\n')
	);

	return {
		queryText,
		standard,
		subject,
		topK,
		answer: answer || 'I could not generate an answer from the available context.',
		sources: sources.map(({ score, chapter, page, text }) => ({ score, chapter, page, text })),
	};
}

module.exports = {
	askBookHelp,
};
