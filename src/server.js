import app from './app.js';

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`WellSpend API running on ${HOST}:${PORT}`);
});
