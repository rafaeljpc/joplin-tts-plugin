const en = {
	title: 'Text-to-Speech',
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
	piperTitle: 'Piper voices',
	piperIntro:
		'Piper speaks offline with voices you download. Download one and select it to use it. The first download also fetches about 30 MB of files shared by all voices.',
	piperLanguage: 'Language',
	piperAllLanguages: 'All languages',
	piperDownload: 'Download',
	piperRemove: 'Remove',
	piperDownloaded: 'Downloaded',
	piperDownloading: 'Downloading… {0}%',
	piperUse: 'Use this voice',
	piperUseOther: 'Use another engine',
	piperOffline: 'No internet connection. Only downloaded voices are listed.',
	piperNoChoices:
		'No voice is downloaded and there is no internet connection, so Piper cannot be used now. Go back to another engine.',
	piperChooseFirst: 'Download and select a voice first.',
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
	piperTitle: 'Vozes do Piper',
	piperIntro:
		'O Piper fala offline com vozes que você baixa. Baixe uma e selecione-a para usar. O primeiro download também baixa cerca de 30 MB de arquivos compartilhados por todas as vozes.',
	piperLanguage: 'Idioma',
	piperAllLanguages: 'Todos os idiomas',
	piperDownload: 'Baixar',
	piperRemove: 'Remover',
	piperDownloaded: 'Baixada',
	piperDownloading: 'Baixando… {0}%',
	piperUse: 'Usar esta voz',
	piperUseOther: 'Usar outro motor',
	piperOffline: 'Sem conexão com a internet. Só as vozes já baixadas aparecem.',
	piperNoChoices:
		'Nenhuma voz foi baixada e não há conexão com a internet, então o Piper não pode ser usado agora. Volte para outro motor.',
	piperChooseFirst: 'Baixe e selecione uma voz primeiro.',
};

const dictionaries: Record<string, Strings> = { en, pt: ptBR };

export function getStrings(locale: string | undefined): Strings {
	const language = (locale ?? 'en').toLowerCase().split(/[-_]/)[0];
	return dictionaries[language] ?? en;
}

export function format(template: string, ...args: (string | number)[]): string {
	return template.replace(/\{(\d+)\}/g, (_, i: string) => String(args[Number(i)] ?? ''));
}
