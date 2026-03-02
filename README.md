# CalcPro2.1

## Local запуск

1. Установить зависимости:

```bash
npm install
```

2. Запустить dev-сервер (обычный):

```bash
npm run dev
```

3. Или запустить на фиксированном адресе `127.0.0.1:5173`:

```bash
npm run dev:local
```

После запуска откройте URL из терминала (обычно `http://127.0.0.1:5173/` или `http://localhost:5173/`).

## Чтобы работала авторизация и все Firebase-функции

- В `.env` должны быть заполнены реальные `VITE_FIREBASE_*` значения (не `YOUR_*`).
- В Firebase Console → Authentication → Settings → Authorized domains добавьте `localhost`.
- Если используете `VITE_ALLOWED_HOSTS`, убедитесь что там есть `localhost,127.0.0.1`.
- После изменений `.env` перезапустите dev-сервер.

## Полезные команды

```bash
npm run build
npm run preview
```
