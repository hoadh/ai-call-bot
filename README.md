
```
cp .env.example .env
export GOOGLE_APPLICATION_CREDENTIALS="google-cloud-key.json"
node server.js
```


## Tests

```
cp cp .env.example .env.test
export GOOGLE_APPLICATION_CREDENTIALS="google-cloud-key.json"
npm test
```