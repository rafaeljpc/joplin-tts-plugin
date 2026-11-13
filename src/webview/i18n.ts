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
	tapToStart: 'Tap Play to start (the device blocks audio that does not start from a tap).',
	missingGoogleKey: 'Set a Google Cloud API key in Settings > Joplin Text-to-Speech.',
	missingAzureKey: 'Set an Azure Speech key and region in Settings > Joplin Text-to-Speech.',
	unsupported: 'Speech synthesis is not available on this device. Try an online engine.',
	webspeechNoStart:
		'System voices did not start. Android WebViews often lack a working speech engine. Set the engine to "Google Translate" in Settings > Joplin Text-to-Speech (online: the text is sent to Google).',
	webspeechNoVoices:
		'No system voices were found. On Android this usually means the WebView has no speech engine. If nothing is spoken, set the engine to "Google Translate" in Settings > Joplin Text-to-Speech (online: the text is sent to Google).',
	piperTitle: 'Piper voices',
	piperAbout: 'About these voices',
	piperIntro:
		'Piper speaks offline with voices you download. Download one and select it to use it. The first download also fetches about 30 MB of files shared by all voices. Voices from the Piper project (huggingface.co/rhasspy/piper-voices, MIT); each voice has the license of its dataset, in its model card.',
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
	tapToStart: 'Toque em ▶ para iniciar (o aparelho bloqueia áudio que não começa por um toque).',
	missingGoogleKey:
		'Defina uma chave da API do Google Cloud em Configurações > Joplin Text-to-Speech.',
	missingAzureKey:
		'Defina a chave e a região do Azure Speech em Configurações > Joplin Text-to-Speech.',
	unsupported: 'A síntese de voz não está disponível neste dispositivo. Tente um motor online.',
	webspeechNoStart:
		'As vozes do sistema não iniciaram. O WebView do Android muitas vezes não tem um motor de voz funcional. Em Configurações > Joplin Text-to-Speech, escolha o motor "Google Translate" (online: o texto é enviado ao Google).',
	webspeechNoVoices:
		'Nenhuma voz do sistema foi encontrada. No Android isso costuma significar que o WebView não tem motor de voz. Se nada for falado, escolha o motor "Google Translate" em Configurações > Joplin Text-to-Speech (online: o texto é enviado ao Google).',
	piperTitle: 'Vozes do Piper',
	piperAbout: 'Sobre as vozes',
	piperIntro:
		'O Piper fala offline com vozes que você baixa. Baixe uma e selecione-a para usar. O primeiro download também baixa cerca de 30 MB de arquivos compartilhados por todas as vozes. Vozes do projeto Piper (huggingface.co/rhasspy/piper-voices, MIT); cada voz tem a licença do seu conjunto de dados, no model card dela.',
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
