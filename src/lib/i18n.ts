const en = {
	title: 'Read aloud',
	play: 'Play',
	pause: 'Pause',
	previous: 'Previous sentence',
	next: 'Next sentence',
	stop: 'Stop',
	close: 'Close',
	voice: 'Voice',
	speed: 'Speed',
	defaultVoice: 'Default voice',
	sentenceOf: 'Sentence {0} of {1}',
	empty: 'This note has nothing to read.',
	ready: 'Ready',
	errorPrefix: 'Error: ',
	missingGoogleKey: 'Set a Google Cloud API key in Settings > Joplin Text-to-Speech.',
	missingAzureKey: 'Set an Azure Speech key and region in Settings > Joplin Text-to-Speech.',
	unsupported: 'Speech synthesis is not available on this device. Try an online engine.',
};

export type Strings = typeof en;

const ptBR: Strings = {
	title: 'Leitura em voz alta',
	play: 'Tocar',
	pause: 'Pausar',
	previous: 'Frase anterior',
	next: 'Próxima frase',
	stop: 'Parar',
	close: 'Fechar',
	voice: 'Voz',
	speed: 'Velocidade',
	defaultVoice: 'Voz padrão',
	sentenceOf: 'Frase {0} de {1}',
	empty: 'Esta nota não tem nada para ler.',
	ready: 'Pronto',
	errorPrefix: 'Erro: ',
	missingGoogleKey:
		'Defina uma chave da API do Google Cloud em Configurações > Joplin Text-to-Speech.',
	missingAzureKey:
		'Defina a chave e a região do Azure Speech em Configurações > Joplin Text-to-Speech.',
	unsupported: 'A síntese de voz não está disponível neste dispositivo. Tente um motor online.',
};

const dictionaries: Record<string, Strings> = { en, pt: ptBR };

export function getStrings(locale: string | undefined): Strings {
	const language = (locale ?? 'en').toLowerCase().split(/[-_]/)[0];
	return dictionaries[language] ?? en;
}

export function format(template: string, ...args: (string | number)[]): string {
	return template.replace(/\{(\d+)\}/g, (_, i: string) => String(args[Number(i)] ?? ''));
}
