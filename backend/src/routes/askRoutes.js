const express = require('express');
const jwt = require('jsonwebtoken');
const { Pinecone } = require('@pinecone-database/pinecone');

const router = express.Router();

/**
 * Extracts the user's query text from multiple places.
 * Priority:
 *   1) body.query/text/message/question
 *   2) body.chat.message/text (chat-portal shape)
 *   3) headers: x-user-query/x-query/x-message/x-question
 *   4) query string: ?query=.../ ?q=...
 *
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractQueryText(req) {
	const fromBodyCandidates = [
		req.body?.query,
		req.body?.text,
		req.body?.message,
		req.body?.question,
		req.body?.chat?.message,
		req.body?.chat?.text,
	];

	for (const candidate of fromBodyCandidates) {
		if (typeof candidate === 'string') {
			const cleaned = candidate.trim();
			if (cleaned) return cleaned;
		}
	}

	const fromHeaderCandidates = [
		req.headers['x-user-query'],
		req.headers['x-query'],
		req.headers['x-message'],
		req.headers['x-question'],
	];

	for (const candidate of fromHeaderCandidates) {
		if (typeof candidate === 'string') {
			const cleaned = candidate.trim();
			if (cleaned) return cleaned;
		}
	}

	const fromQueryCandidates = [req.query?.query, req.query?.q];
	for (const candidate of fromQueryCandidates) {
		if (typeof candidate === 'string') {
			const cleaned = candidate.trim();
			if (cleaned) return cleaned;
		}
	}

	return null;
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

async function embedWithGemini(texts) {
	const GEMINI_API_KEY = getEnvOrThrow('GEMINI_API_KEY');
	const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'models/gemini-embedding-001';
	const EMBEDDING_DIMENSION = Number(process.env.EMBEDDING_DIMENSION || '1024');

	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-goog-api-key': GEMINI_API_KEY,
			},
			body: JSON.stringify({
				requests: texts.map((text) => ({
					model: GEMINI_EMBEDDING_MODEL,
					taskType: 'RETRIEVAL_DOCUMENT',
					outputDimensionality: EMBEDDING_DIMENSION,
					content: { parts: [{ text }] },
				})),
			}),
		}
	);

	if (!response.ok) {
		const bodyText = await response.text();
		throw new Error(`Embedding API failed: ${response.status} ${bodyText}`);
	}

	const data = await response.json();
	return (data.embeddings ?? []).map((e) => e.values ?? []);
}

async function generateWithGemini({ question, context }) {
	const GEMINI_API_KEY = getEnvOrThrow('GEMINI_API_KEY');
	const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'models/gemini-3.5-flash';

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

	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/${GEMINI_CHAT_MODEL}:generateContent`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-goog-api-key': GEMINI_API_KEY,
			},
			body: JSON.stringify({
				contents: [
					{
						role: 'user',
						parts: [{ text: prompt }],
					},
				],
			}),
		}
	);

	if (!response.ok) {
		const bodyText = await response.text();
		throw new Error(`Gemini generateContent failed: ${response.status} ${bodyText}`);
	}

	const data = await response.json();
	const text =
		data?.candidates?.[0]?.content?.parts?.map((p) => p?.text).filter(Boolean).join('') ||
		'';

	return text.trim();
}

/**
 * POST /ask
 * Accepts user query from:
 *  - body: { query | text | message | question | chat: { message|text } }
 *  - headers: x-user-query | x-query | x-message | x-question
 *
 * Optional body fields:
 *  - standard, subject, topK
 */
router.post('/ask', async (req, res) => {
	const queryText = extractQueryText(req);
	if (!queryText) {
		res.status(400);
		throw new Error('Missing query text in body/header/querystring');
	}

	const standardFromBody = req.body?.standard ?? null;
	const subjectFromBody = req.body?.subject ?? null;
	const standardFromToken = decodeStandardFromAuth(req);

	const standard = standardFromBody ?? standardFromToken ?? null; // stored as string in geo.js (e.g. "9")
	const subject = subjectFromBody ?? req.headers['x-subject'] ?? null; // geo.js used "Geography"

	const topK = Math.max(1, Number(req.body?.topK ?? req.headers['x-topk'] ?? 5));

	// If Pinecone/Gemini aren't configured, still return a normalized response.
	const requiredEnv = ['PINECONE_API_KEY', 'PINECONE_INDEX_NAME', 'GEMINI_API_KEY'];
	const missingEnv = requiredEnv.filter((key) => !process.env[key]);

	if (missingEnv.length > 0) {
		return res.json({
			success: true,
			normalized: { queryText, standard, subject },
			answer: `AI is not configured yet (missing env: ${missingEnv.join(', ')}).`,
			sources: [],
		});
	}

	const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
	const index = pc.Index(process.env.PINECONE_INDEX_NAME);

	const embeddingVectors = await embedWithGemini([queryText]);
	const queryVector = embeddingVectors?.[0];
	if (!queryVector || !Array.isArray(queryVector) || queryVector.length === 0) {
		res.status(500);
		throw new Error('Failed to embed query');
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

	const matches = pineconeResponse?.matches ?? [];
	const sources = matches
		.map((m) => {
			const meta = m?.metadata || {};
			return {
				score: m?.score ?? null,
				chapter: meta?.chapter_name ?? meta?.chapter ?? null,
				page: meta?.page ?? null,
				text: meta?.text ?? null,
			};
		})
		.filter((s) => Boolean(s.text));

	const context = sources
		.slice(0, topK)
		.map((s, idx) => `Excerpt ${idx + 1} (page ${s.page ?? 'N/A'}):\n${s.text}`)
		.join('\n\n');

	const answer = await generateWithGemini({ question: queryText, context });

	res.json({
		success: true,
		question: queryText,
		answer: answer || 'I could not generate an answer from the available context.',
		sources: sources.map(({ score, chapter, page, text }) => ({ score, chapter, page, text })),
	});
});

module.exports = router;

