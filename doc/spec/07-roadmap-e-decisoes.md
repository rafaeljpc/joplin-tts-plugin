# 07 — Decisões, pendências e roadmap

## Decisões tomadas

| Decisão                                                  | Motivo                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Layout do player aprovado (ver [04](04-prototipo-ui.md)) | Aprovado na sessão de design                                                    |
| Desktop primeiro, com `speechSynthesis`                  | Único caminho certo; Android/iOS dependem de testes e da plataforma             |
| Segundo motor: Google Cloud TTS (áudio via API)          | Mesmo código serve desktop, Android e iOS; só troca o provedor                  |
| v0.1 mostra a frase **só no painel**                     | Destaque dentro da nota é complexo (exigiria _content script_ no viewer/editor) |
| Player do painel em JS/TS puro, sem framework            | Bundle pequeno e fácil de testar                                                |
| Pausa = cancelar e repetir a frase                       | `speechSynthesis.pause()` é inconsistente entre plataformas                     |
| Fluxo de branches: gitflow com `main` como principal     | Pedido do autor                                                                 |

## Pendências e perguntas da sessão original

1. **Chave do Google Cloud** para testar a voz Google. Sem ela, só a voz do sistema é testada.
2. Confirmar no catálogo oficial de plugins que ainda não existe um plugin equivalente.
3. Testar cedo se `speechSynthesis` existe no WebView do Joplin Android.

## Checklist de teste manual por plataforma

- [ ] Windows — vozes do sistema listadas, play/pause/velocidade
- [ ] macOS — idem
- [ ] Linux — verificar se `speechSynthesis` funciona (há relato de falha)
- [ ] Qualquer desktop — motor Google com chave válida e inválida
- [ ] Android — `speechSynthesis` presente? Se não, motor Google
- [ ] iOS — depende de o plugin ser "recomendado"

## Roadmap

| Versão | Itens                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1    | Painel, comandos, Web Speech, Google Cloud TTS, testes com 100% de cobertura (**este repositório**)                                                     |
| 0.2    | Pré-carregar o áudio da próxima frase (Google) para eliminar pausas; ler apenas o texto selecionado                                                     |
| 0.3    | Destaque da frase atual dentro da nota (content script no visualizador/editor)                                                                          |
| 0.4    | Motor offline Piper/WASM (ideia citada no fórum do Joplin; sem exemplo pronto conhecido)                                                                |
| ≥ 1.0  | Publicação no catálogo oficial; submissão como plugin "recomendado" para o iOS; avaliar API nativa de TTS no Android (contribuição ao núcleo do Joplin) |
