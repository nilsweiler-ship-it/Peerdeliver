import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { env } from './config';
import { errorHandler, apiLimiter } from './middleware';
import routes from './routes';
import { setupSocket } from './socket';
import { stripeWebhook } from './controllers/webhook';
import { webhook as payrexxWebhook } from './controllers/payrexx';

const app = express();
const httpServer = createServer(app);

app.set('trust proxy', 1);
app.use(cors());

// Payment webhooks need the raw body for signature checks — mount BEFORE express.json().
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);
app.post('/webhooks/payrexx', express.raw({ type: '*/*' }), payrexxWebhook);

app.use(express.json());
app.use(apiLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', routes);

app.use(errorHandler);

setupSocket(httpServer);

httpServer.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${env.PORT}`);
});
