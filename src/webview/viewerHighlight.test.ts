import { createViewerHighlighter, detectHighlightEnv, findTextRange } from './viewerHighlight';

const normalized = (range: Range | null) => range?.toString().replace(/\s+/g, ' ');

describe('findTextRange', () => {
	beforeEach(() => {
		document.body.innerHTML =
			'<h1>Title</h1><p>Hello <b>big</b>  world. Bye.</p><script>ignored text</script><style>.x{}</style>';
	});

	it('finds text across elements, ignoring whitespace differences', () => {
		expect(normalized(findTextRange(document, 'Hello big world.'))).toBe('Hello big world.');
		expect(normalized(findTextRange(document, 'Bye.'))).toBe('Bye.');
		expect(normalized(findTextRange(document, 'big\n world'))).toBe('big world');
	});

	it('returns null when the text is missing, empty or only in scripts', () => {
		expect(findTextRange(document, 'Nothing here')).toBeNull();
		expect(findTextRange(document, '   ')).toBeNull();
		expect(findTextRange(document, 'ignored text')).toBeNull();
	});

	it('returns null when there is no body', () => {
		const doc = { body: null } as unknown as Document;
		expect(findTextRange(doc, 'x')).toBeNull();
	});
});

describe('detectHighlightEnv', () => {
	it('wraps the Highlight API when available', () => {
		const highlights = { set: jest.fn(), delete: jest.fn() };
		class FakeHighlight {
			constructor(public range: Range) {}
		}
		const env = detectHighlightEnv({ CSS: { highlights }, Highlight: FakeHighlight });
		expect(env?.highlights).toBe(highlights);
		const range = document.createRange();
		expect(env?.createHighlight(range)).toEqual(new FakeHighlight(range));
	});

	it('returns null when either piece is missing', () => {
		expect(detectHighlightEnv({})).toBeNull();
		expect(detectHighlightEnv({ CSS: {} })).toBeNull();
		expect(
			detectHighlightEnv({ CSS: { highlights: { set: jest.fn(), delete: jest.fn() } } }),
		).toBeNull();
	});
});

describe('createViewerHighlighter', () => {
	let scrollIntoView: jest.Mock;
	const setup = () => {
		const env = {
			highlights: { set: jest.fn(), delete: jest.fn() },
			createHighlight: jest.fn((range: Range) => ({ range })),
		};
		return { env, highlighter: createViewerHighlighter(document, env) };
	};

	beforeEach(() => {
		document.head.innerHTML = '';
		document.body.innerHTML = '<p>First sentence. Second sentence.</p>';
		scrollIntoView = jest.fn();
		Element.prototype.scrollIntoView = scrollIntoView;
	});

	it('adds the ::highlight style once', () => {
		setup();
		expect(document.head.querySelector('style')?.textContent).toContain('::highlight(tts-current)');
	});

	it('highlights a sentence, scrolls to it and does not repeat itself', () => {
		const { env, highlighter } = setup();
		highlighter.show('Second sentence.');
		expect(env.highlights.set).toHaveBeenCalledWith('tts-current', expect.any(Object));
		expect(normalized(env.createHighlight.mock.calls[0][0])).toBe('Second sentence.');
		expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
		highlighter.show('Second sentence.');
		expect(env.highlights.set).toHaveBeenCalledTimes(1);
	});

	it('clears the highlight for null and for text that is not in the note', () => {
		const { env, highlighter } = setup();
		highlighter.show('First sentence.');
		highlighter.show(null);
		expect(env.highlights.delete).toHaveBeenCalledWith('tts-current');
		highlighter.show('Not in the note.');
		expect(env.highlights.delete).toHaveBeenCalledTimes(2);
	});
});
