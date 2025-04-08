
```
cp .env.example .env
export GOOGLE_APPLICATION_CREDENTIALS="google-tts-key.json"
node server.js
```


## Tests

```
cp cp .env.example .env.test
export GOOGLE_APPLICATION_CREDENTIALS="google-tts-key.json"
npm test
```