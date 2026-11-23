# Treino em Casa

Site pessoal de treino com o kit de halteres ajustáveis (15 kg / 20 kg + barra longa + presilhas) e o que tenho em casa.

- **Plano personalizado** gerado a partir do objetivo, nível, dias por semana, tempo e equipamentos.
- **Cargas reais do kit**: só sugere pesos possíveis de montar com as anilhas e mostra como montar cada lado.
- **Progressão dupla automática**: bateu o máximo de repetições em todas as séries → sobe para a próxima carga.
- **Registro completo**: o que fez, quando, séries, cargas, repetições, duração, sensação e observações; outras atividades e peso corporal.
- **Progresso**: gráficos por exercício, treinos por semana, séries por músculo, recordes.
- **Privado**: os dados ficam só no aparelho (localStorage), criptografados com AES-GCM quando há PIN. Nada é enviado para servidor. Backup por exportação/importação de JSON.
- Funciona offline e pode ser instalado na tela inicial (PWA).

## Rodar local

```bash
python -m http.server 5174
```

## Testes

```bash
npm test
```

Ao mudar arquivos do app, aumente a versão de `CACHE` em `sw.js` para os aparelhos pegarem a atualização.
