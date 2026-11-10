import { markdownToLines, markdownToPlainText } from './markdown';
import { splitSentences } from './sentences';

export interface Sentence {
	text: string;
	/** 0-based line of the note body the sentence comes from; -1 for the title. */
	line: number;
}

/** The last thing the user did in the editor or in the rendered viewer. */
export type Interaction =
	| { source: 'editor'; cursor: { line: number; column: number }; selection: string }
	| { source: 'viewer'; selection: string };

export interface ReadingPlan {
	sentences: string[];
	/** Index of the sentence where reading starts. */
	startIndex: number;
}

export interface PlanNote {
	title: string;
	body: string;
}

export interface PlanOptions {
	readTitle: boolean;
	language: string;
}

/** Validates a message coming from a content script. */
export function parseInteraction(message: unknown): Interaction | null {
	if (typeof message !== 'object' || message === null) return null;
	const { source, selection, cursor } = message as {
		source?: unknown;
		selection?: unknown;
		cursor?: { line?: unknown; column?: unknown } | null;
	};
	const text = typeof selection === 'string' ? selection : '';
	if (source === 'viewer') return { source, selection: text };
	const { line, column } = cursor ?? {};
	if (source === 'editor' && Number.isInteger(line) && Number.isInteger(column)) {
		return {
			source,
			selection: text,
			cursor: { line: line as number, column: column as number },
		};
	}
	return null;
}

/** Every sentence of the note, in reading order, tagged with its source line. */
export function buildSentences(note: PlanNote, options: PlanOptions): Sentence[] {
	const result: Sentence[] = [];
	if (options.readTitle) {
		for (const text of splitSentences(note.title.replace(/[.!?…]*$/, '.'), options.language)) {
			result.push({ text, line: -1 });
		}
	}
	markdownToLines(note.body).forEach((line, index) => {
		for (const text of splitSentences(line, options.language)) result.push({ text, line: index });
	});
	return result;
}

/**
 * Picks the sentence under the cursor. Sentences on the cursor line are chosen
 * proportionally to the column; a cursor on a line without speakable text
 * starts at the next sentence (or the last one when there is none).
 */
export function startIndexForCursor(
	sentences: Sentence[],
	cursor: { line: number; column: number },
	rawLineLength: number,
): number {
	if (sentences.length === 0) return 0;
	const onLine = sentences.flatMap((s, i) => (s.line === cursor.line ? [i] : []));
	if (onLine.length > 0) {
		const total = onLine.reduce((sum, i) => sum + sentences[i].text.length, 0);
		const ratio = rawLineLength > 0 ? Math.min(1, cursor.column / rawLineLength) : 0;
		const target = ratio * total;
		let seen = 0;
		for (const i of onLine) {
			seen += sentences[i].text.length;
			if (target < seen) return i;
		}
		return onLine[onLine.length - 1];
	}
	const next = sentences.findIndex((s) => s.line > cursor.line);
	return next === -1 ? sentences.length - 1 : next;
}

/**
 * Decides what to read and where to start:
 * - text selected (in the editor or the viewer): only that text;
 * - otherwise, in the editor: the whole note, starting at the cursor;
 * - otherwise: the whole note from the beginning.
 */
export function planReading(
	note: PlanNote,
	options: PlanOptions,
	interaction: Interaction | null,
): ReadingPlan {
	const selection = interaction?.selection.trim() ?? '';
	if (interaction && selection) {
		// Editor selections are raw Markdown; viewer selections are already plain text.
		const text = interaction.source === 'editor' ? markdownToPlainText(selection) : selection;
		const sentences = splitSentences(text, options.language);
		if (sentences.length > 0) return { sentences, startIndex: 0 };
	}
	const all = buildSentences(note, options);
	const sentences = all.map((s) => s.text);
	if (interaction?.source === 'editor') {
		const rawLine = note.body.split(/\r\n|\r|\n/)[interaction.cursor.line] ?? '';
		return {
			sentences,
			startIndex: startIndexForCursor(all, interaction.cursor, rawLine.length),
		};
	}
	return { sentences, startIndex: 0 };
}
